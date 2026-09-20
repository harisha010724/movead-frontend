import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/shared/api/client';
import LiveTrackingPage from './LiveTrackingPage';

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn() } }));

/** The top bar wants a session and a notification query; neither is under test. */
vi.mock('@/shared/layout/Page', () => ({
  Page: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

/**
 * The Google Maps SDK does not load in jsdom, so the map reports its props
 * instead of drawing. What matters here is which vehicle the page tells it to
 * follow — the marker drawing itself is not something jsdom can observe.
 */
vi.mock('@/shared/maps/LiveFleetMap', () => ({
  LiveFleetMap: ({
    positions,
    selectedRef,
  }: {
    positions: { vehicleRef: string }[];
    selectedRef: string | null;
  }) => (
    <div data-testid="map" data-selected={selectedRef ?? ''}>
      {positions.map((p) => p.vehicleRef).join(',')}
    </div>
  ),
}));

const get = vi.mocked(api.get);

const FLEET = [
  { vehicleRef: 'KA05AB9012', lat: 12.97, lon: 77.6, state: 'RUNNING', updatedAt: iso() },
  { vehicleRef: 'KA09AB3344', lat: 12.98, lon: 77.61, state: 'IDLE', updatedAt: iso() },
];

function iso() {
  return new Date().toISOString();
}

/** Mirrors the server: normalised, substring, and absent means everything. */
function respond() {
  get.mockImplementation((_path: string, options?: { query?: Record<string, unknown> }) => {
    const asked = options?.query?.vehicleNumber;
    const needle = (typeof asked === 'string' ? asked : '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();
    const items = needle ? FLEET.filter((v) => v.vehicleRef.includes(needle)) : FLEET;
    return Promise.resolve({ items, updatedAt: iso() });
  });
}

/** The plates actually sent to the server, in order. */
function searchedNumbers(): string[] {
  return get.mock.calls
    .map(([, options]) => (options as { query?: Record<string, unknown> } | undefined)?.query)
    .map((query) => query?.vehicleNumber)
    .filter((value): value is string => typeof value === 'string');
}

function Url() {
  return <span data-testid="url">{useLocation().search}</span>;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/tracking']}>
        <LiveTrackingPage />
        <Url />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function search(value: string) {
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search by vehicle number' }), {
    target: { value },
  });
}

beforeEach(() => {
  get.mockReset();
  respond();
});

describe('live tracking by vehicle number', () => {
  it('lists plates the way they are painted, not as stored', async () => {
    renderPage();

    expect(await screen.findByRole('button', { name: 'KA 05 AB 9012' })).toBeInTheDocument();
  });

  it('asks the server for the plate rather than filtering what it already has', async () => {
    renderPage();
    await screen.findByRole('button', { name: 'KA 05 AB 9012' });

    search('3344');

    await waitFor(() => {
      expect(get).toHaveBeenLastCalledWith(
        '/v1/vehicles/live-positions',
        expect.objectContaining({ query: expect.objectContaining({ vehicleNumber: '3344' }) }),
      );
    });
    expect(
      await screen.findByRole('button', { name: 'KA 09 AB 3344' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'KA 05 AB 9012' })).not.toBeInTheDocument();
  });

  it('strips the spaces and dashes before they reach the server', async () => {
    renderPage();
    await screen.findByRole('button', { name: 'KA 05 AB 9012' });

    search('ka 05-ab');

    await waitFor(() => {
      expect(get).toHaveBeenLastCalledWith(
        '/v1/vehicles/live-positions',
        expect.objectContaining({ query: expect.objectContaining({ vehicleNumber: 'KA05AB' }) }),
      );
    });
  });

  /*
   * One character is too broad to be worth a round trip, and the server
   * rejects it. The page must not ask: a 400 rendered as an error state while
   * someone is still typing is the screen telling them they are wrong.
   */
  it('waits for a second character before searching', async () => {
    renderPage();
    await screen.findByRole('button', { name: 'KA 05 AB 9012' });
    get.mockClear();

    search('K');
    // Comfortably past the debounce, so this is "it never asked" rather than
    // "it had not asked yet".
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(searchedNumbers()).toEqual([]);

    search('KA');

    await waitFor(() => {
      expect(searchedNumbers()).toEqual(['KA']);
    });
  });

  it('follows the vehicle on the map once the search narrows to one', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('map')).toHaveAttribute('data-selected', '');
    });

    search('KA09AB3344');

    await waitFor(() => {
      expect(screen.getByTestId('map')).toHaveAttribute('data-selected', 'KA09AB3344');
    });
  });

  it('puts the plate in the URL, so a tracked vehicle can be linked to', async () => {
    renderPage();
    await screen.findByRole('button', { name: 'KA 05 AB 9012' });

    search('ka09');

    await waitFor(() => {
      expect(screen.getByTestId('url')).toHaveTextContent('vehicle=KA09');
    });
  });

  it('starts from the plate in the URL when one is already there', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/tracking?vehicle=KA09AB3344']}>
          <LiveTrackingPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('button', { name: 'KA 09 AB 3344' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'KA 05 AB 9012' })).not.toBeInTheDocument();
  });

  it('says which number found nothing, and offers the way back', async () => {
    renderPage();
    await screen.findByRole('button', { name: 'KA 05 AB 9012' });

    search('TN01ZZ0000');

    expect(
      await screen.findByText(/No tracking vehicle matches TN 01 ZZ 0000/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(await screen.findByRole('button', { name: 'KA 05 AB 9012' })).toBeInTheDocument();
  });
});
