import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/shared/api/client';
import { formatDate } from '@/shared/format';
import { AdLocationsCard } from './AdLocationsCard';
import type { AvailableVehicle } from './vehiclesInZones';
import type { ZonePolygons } from '@/shared/maps/types';

vi.mock('@/shared/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

const post = vi.mocked(api.post);

const POLYGONS: ZonePolygons = {
  prime: {
    path: [
      { lat: 12.97, lng: 77.6 },
      { lat: 12.97, lng: 77.62 },
      { lat: 12.98, lng: 77.62 },
    ],
  },
};

function vehicle(overrides: Partial<AvailableVehicle> = {}): AvailableVehicle {
  return {
    id: 'veh_1',
    vehicleType: 'CAB',
    publicRef: 'VH-8840',
    registrationNumber: 'KA01AB1234',
    areaLabel: 'Vijayanagar, Bengaluru',
    lat: 12.9756,
    lng: 77.6069,
    zone: 'prime',
    status: 'AVAILABLE',
    availability: 'available',
    ...overrides,
  };
}

/** Booked, and the campaign holding it ends on a known date. */
function booked(overrides: Partial<AvailableVehicle> = {}): AvailableVehicle {
  return vehicle({
    status: 'ACTIVE',
    availability: 'booked',
    bookedUntil: '2026-09-30',
    ...overrides,
  });
}

/** How the plate above is drawn once grouped — what a reader actually sees. */
const PLATE = 'KA 01 AB 1234';

function respondWith(items: AvailableVehicle[]) {
  post.mockResolvedValue({
    items,
    primeCount: items.filter((row) => row.zone === 'prime').length,
    secondaryCount: items.filter((row) => row.zone === 'secondary').length,
    availableCount: items.filter((row) => row.availability === 'available').length,
  });
}

/**
 * The card is a summary and a button; the editor is in the dialog behind it.
 * Most cases here are about the editor, so this opens it unless asked not to.
 */
function renderCard(
  items: AvailableVehicle[],
  props: Partial<Parameters<typeof AdLocationsCard>[0]> = {},
  { open = true } = {},
) {
  respondWith(items);
  const onChange = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  render(
    <QueryClientProvider client={client}>
      <AdLocationsCard
        city="Bengaluru"
        vehicleType="CAB"
        locations={[]}
        polygons={POLYGONS}
        onLocationsChange={vi.fn()}
        onPolygonsChange={vi.fn()}
        endpoint="/v1/campaigns/available-vehicles"
        selectedIds={[]}
        onChange={onChange}
        {...props}
      />
    </QueryClientProvider>,
  );

  if (open) fireEvent.click(screen.getByRole('button', { name: /zones and vehicles/ }));

  return { onChange };
}

function rowFor(text: string): HTMLElement {
  return screen.getByText(text).closest('li') as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the vehicle picker', () => {
  it('names the type, the number, the area and the status of each vehicle', async () => {
    renderCard([vehicle()]);

    expect(await screen.findByText(PLATE)).toBeInTheDocument();
    const row = rowFor(PLATE);
    expect(within(row).getByText('Cab')).toBeInTheDocument();
    expect(within(row).getByText('Vijayanagar, Bengaluru')).toBeInTheDocument();
    expect(within(row).getByText('Prime')).toBeInTheDocument();
    expect(within(row).getByText('Available')).toBeInTheDocument();
  });

  /**
   * AC-22.4. A buyer is told which vehicle they are ordering, grouped the way
   * the plate is painted so it can be read back over the phone. The opaque
   * reference stays in the payload but is not what the row is named by.
   */
  it('names a vehicle by its plate, not by the internal reference', async () => {
    renderCard([vehicle()]);

    expect(await screen.findByText(PLATE)).toBeInTheDocument();
    expect(screen.queryByText('VH-8840')).not.toBeInTheDocument();
  });

  /**
   * ADV-039, and the whole of what survives of it here: the vehicle is named,
   * the person driving it is not. The advertiser endpoint simply omits the
   * name, so there is nothing to draw and no empty line where it would go.
   */
  it('names no driver when the response carries no names', async () => {
    renderCard([vehicle()]);

    await screen.findByText(PLATE);
    expect(screen.queryByText('Rahul Kumar')).not.toBeInTheDocument();
    expect(within(rowFor(PLATE)).queryByText('—')).not.toBeInTheDocument();
  });

  it('names the driver when admin asks', async () => {
    renderCard([vehicle({ driverName: 'Rahul Kumar' })], {
      endpoint: '/v1/admin/vehicles/in-zones',
    });

    expect(await screen.findByText(PLATE)).toBeInTheDocument();
    expect(within(rowFor(PLATE)).getByText('Rahul Kumar')).toBeInTheDocument();
  });

  /**
   * A server that has not been deployed yet answers without a plate. A row
   * named by its reference reads worse than one named by its plate, but far
   * better than a blank cell where the vehicle should be.
   */
  it('falls back to the reference when the response carries no plate', async () => {
    const { registrationNumber: _omitted, ...withoutPlate } = vehicle();
    renderCard([withoutPlate as AvailableVehicle]);

    expect(await screen.findByText('VH-8840')).toBeInTheDocument();
  });

  it('lists a booked vehicle but will not let it be picked', async () => {
    renderCard([booked({ id: 'veh_2' })]);

    await screen.findByText(PLATE);
    expect(screen.getByText('Booked')).toBeInTheDocument();
    expect(within(rowFor(PLATE)).getByRole('checkbox')).toBeDisabled();
  });

  /**
   * AC-22.4c. "Booked" on its own is a dead end a buyer can only resolve by
   * ringing someone. The campaign holding the vehicle has an end date, so the
   * answer exists and the row should give it.
   */
  it('says when a booked vehicle comes free', async () => {
    renderCard([booked()]);

    await screen.findByText(PLATE);
    expect(
      within(rowFor(PLATE)).getByText(
        `On a campaign until ${formatDate('2026-09-30')} — free from ${formatDate('2026-10-01')}`,
      ),
    ).toBeInTheDocument();
  });

  /**
   * The date is the *campaign's*, and a vehicle can be booked without one
   * reaching this response. Saying "until Invalid Date" would be worse than
   * saying nothing, so the generic explanation stands in.
   */
  it('still explains a booked vehicle when no end date came back', async () => {
    const { bookedUntil: _none, ...withoutDate } = booked();
    renderCard([withoutDate]);

    await screen.findByText(PLATE);
    const row = rowFor(PLATE);
    expect(within(row).getByText(/Already carrying a live campaign/)).toBeInTheDocument();
    expect(within(row).queryByText(/until/)).not.toBeInTheDocument();
  });

  it('offers no free-from date for a vehicle that is merely unapproved', async () => {
    renderCard([vehicle({ status: 'PENDING', availability: 'pending', bookedUntil: '2026-09-30' })]);

    await screen.findByText(PLATE);
    const row = rowFor(PLATE);
    expect(within(row).getByText(/has not approved this vehicle/)).toBeInTheDocument();
    expect(within(row).queryByText(new RegExp(formatDate('2026-09-30')))).not.toBeInTheDocument();
  });

  it('explains nothing on a vehicle that can simply be bought', async () => {
    renderCard([vehicle()]);

    await screen.findByText(PLATE);
    const row = rowFor(PLATE);
    expect(within(row).queryByText(/cannot|until|not approved/i)).not.toBeInTheDocument();
  });

  /**
   * AC-22.4d. Two controls because there are two things to do with a vehicle:
   * looking at one on the map must not order it, or a buyer cannot examine
   * their options without buying them — and a booked row, which can never be
   * ordered, would have nothing left to click.
   */
  it('shows a vehicle on the map without ordering it', async () => {
    const { onChange } = renderCard([vehicle()]);

    await screen.findByText(PLATE);
    fireEvent.click(within(rowFor(PLATE)).getByRole('button'));

    expect(onChange).not.toHaveBeenCalled();
  });

  /**
   * AC-22.4d. The editor is behind a button and needs the room a dialog gives
   * it; the map was unusably small in a column the spend estimate had already
   * narrowed. Nothing of it may remain on the page — a second Google map is a
   * second set of markers listening for a click on the same corner.
   */
  it('keeps the editor in the dialog and nothing of it on the page', async () => {
    renderCard([vehicle()], {}, { open: false });

    expect(screen.queryByRole('region', { name: 'Campaign zone map' })).not.toBeInTheDocument();
    expect(screen.queryByText(PLATE)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /zones and vehicles/ }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByRole('region', { name: 'Campaign zone map' })).toHaveLength(1);
    expect(await screen.findByText(PLATE)).toBeInTheDocument();
  });

  it('takes the editor away again on Done', async () => {
    renderCard([vehicle()]);
    await screen.findByText(PLATE);

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Campaign zone map' })).not.toBeInTheDocument();
  });

  /* The selection is the form's, so it has to survive the move both ways. */
  it('keeps the selection across opening', async () => {
    const { onChange } = renderCard([vehicle()], { selectedIds: ['veh_1'] });
    await screen.findByText(PLATE);

    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(onChange).not.toHaveBeenCalled();
  });
});

/**
 * The closed card is the only account the form gives of a decision made
 * somewhere else. "Ad locations" over an empty box would send a buyer back
 * into the dialog to find out whether they had drawn anything.
 */
describe('the closed card', () => {
  it('says nothing is drawn, and asks no questions of the server', () => {
    renderCard([], { polygons: {} }, { open: false });

    expect(screen.getByText(/No zones drawn yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Draw zones and pick vehicles' })).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('names the zones drawn and how much of what they caught is taken', async () => {
    renderCard([vehicle(), vehicle({ id: 'veh_2', registrationNumber: 'KA02CD5678' })], {
      selectedIds: ['veh_1'],
    }, { open: false });

    expect(await screen.findByText('1 of 2 vehicles selected.')).toBeInTheDocument();
    expect(screen.getByText('Prime')).toBeInTheDocument();
    expect(screen.getByText('3 corners')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit zones and vehicles' })).toBeInTheDocument();
  });

  it('does not claim an empty zone is a finished choice', async () => {
    renderCard([], {}, { open: false });

    expect(
      await screen.findByText(/No vehicles have an operating pin inside these outlines/),
    ).toBeInTheDocument();
  });

  it('lets a booked vehicle be shown on the map even though it cannot be had', async () => {
    renderCard([booked()]);

    await screen.findByText(PLATE);
    const row = rowFor(PLATE);
    expect(within(row).getByRole('checkbox')).toBeDisabled();
    expect(within(row).getByRole('button')).toBeEnabled();
  });

  it('lists a vehicle still in review but will not let it be picked', async () => {
    renderCard([vehicle({ status: 'PENDING', availability: 'pending' })]);

    await screen.findByText(PLATE);
    expect(screen.getByText('Pending review')).toBeInTheDocument();
    expect(within(rowFor(PLATE)).getByRole('checkbox')).toBeDisabled();
  });

  it('counts only what can be ordered', async () => {
    renderCard([
      vehicle(),
      vehicle({
        id: 'veh_2',
        registrationNumber: 'KA02CD5678',
        availability: 'booked',
        status: 'ACTIVE',
      }),
    ]);

    expect(await screen.findByText(/1 available/)).toBeInTheDocument();
    expect(screen.getByText(/2 Prime/)).toBeInTheDocument();
  });

  it('selects every available vehicle and no others', async () => {
    const { onChange } = renderCard([
      vehicle(),
      vehicle({
        id: 'veh_2',
        registrationNumber: 'KA02CD5678',
        availability: 'booked',
        status: 'ACTIVE',
      }),
      vehicle({ id: 'veh_3', registrationNumber: 'KA03EF9012' }),
    ]);

    fireEvent.click(await screen.findByRole('button', { name: 'Select all available' }));

    expect(onChange).toHaveBeenCalledWith(['veh_1', 'veh_3']);
  });

  it('says so when the zone has vehicles but none can be ordered', async () => {
    renderCard([vehicle({ availability: 'booked', status: 'ACTIVE' })]);

    expect(await screen.findByText(/None of these can be ordered yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Select all/ })).not.toBeInTheDocument();
  });

  /**
   * The list is a snapshot. If operations assign a vehicle between drawing the
   * zone and placing the order, the selection has to give it up rather than
   * carry a request nobody can fill.
   */
  it('drops a vehicle from the selection once it is booked', async () => {
    const { onChange } = renderCard(
      [
        vehicle({ availability: 'booked', status: 'ACTIVE' }),
        vehicle({ id: 'veh_3', registrationNumber: 'KA03EF9012' }),
      ],
      { selectedIds: ['veh_1', 'veh_3'] },
    );

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(['veh_3']);
    });
  });
});
