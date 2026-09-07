import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/shared/api/client';
import type { AdminDriverDetail, AdminVehicle, DocumentChecklistItem } from '@/shared/types/domain';
import DriverReviewPage from './DriverReviewPage';

vi.mock('@/shared/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/shared/auth/guards', () => ({
  // Every decision on this page is permission-gated. The gate has its own
  // tests; here it would only hide the buttons under test.
  Can: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/shared/layout/Page', () => ({
  // The page chrome carries a top bar that wants the whole auth context. None
  // of it is what this screen is for.
  Page: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);

function documentWith(overrides: Partial<DocumentChecklistItem> = {}): DocumentChecklistItem {
  return {
    kind: 'LICENCE',
    isMandatory: true,
    status: 'uploaded',
    documentId: 'doc_licence',
    expiresOn: '2030-04-01',
    rejectionReason: null,
    contentType: 'image/jpeg',
    uploadedAt: '2026-08-25T06:30:00.000Z',
    ...overrides,
  };
}

function vehicleWith(overrides: Partial<AdminVehicle> = {}): AdminVehicle {
  return {
    id: 'veh_1',
    driverId: 'drv_1',
    registrationNumber: 'KA01AB1234',
    category: 'AUTO',
    bodyType: null,
    makeModel: 'Bajaj RE',
    colour: null,
    manufactureYear: null,
    fuelType: null,
    imageKey: null,
    imageUrl: null,
    status: 'PENDING',
    rejectionReason: null,
    suspendedReason: null,
    ...overrides,
  };
}

function detailWith(overrides: Partial<AdminDriverDetail> = {}): AdminDriverDetail {
  return {
    driver: {
      id: 'drv_1',
      mobile: '8988378332',
      name: 'Sujay',
      photoKey: null,
      status: 'DOCUMENTS_SUBMITTED',
      suspendedReason: null,
      rejectionReason: null,
      joinedAt: '2026-08-25T04:00:00.000Z',
      city: 'Bengaluru',
      location: { city: 'Bengaluru', label: 'Vijayanagar, Bengaluru', lat: 12.9, lng: 77.5 },
    },
    vehicles: [vehicleWith()],
    driverDocuments: [documentWith()],
    vehicleDocuments: {
      veh_1: [documentWith({ kind: 'RC', documentId: 'doc_rc', expiresOn: null })],
    },
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/drivers/drv_1']}>
        <Routes>
          <Route path="/admin/drivers/:id" element={<DriverReviewPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue(detailWith());
  post.mockResolvedValue({});
});

describe('what the reviewer is shown', () => {
  it('lists what the driver sent, on both checklists', async () => {
    renderPage();

    expect(await screen.findByText('Driving licence')).toBeInTheDocument();
    expect(screen.getByText('Registration certificate')).toBeInTheDocument();
    expect(screen.getAllByText('Awaiting review')).toHaveLength(2);
  });

  it('names the driver and the plate, so the reviewer knows whose papers these are', async () => {
    renderPage();

    expect(await screen.findByText('Sujay')).toBeInTheDocument();
    // Once as a fact about the driver, once as the heading of its own card.
    expect(screen.getAllByText('KA 01 AB 1234')).toHaveLength(2);
  });

  it('offers nothing to open for a document that was never sent', async () => {
    get.mockResolvedValue(
      detailWith({
        driverDocuments: [documentWith({ status: 'missing', documentId: null })],
      }),
    );
    renderPage();

    expect(await screen.findByText('Nothing sent')).toBeInTheDocument();
  });

  /*
   * None of this comes from onboarding — AC-04 asks an admin for a plate and a
   * type and stops, so the make, colour, year and fuel were all typed by the
   * driver on their own phone. The operator's job is to check them against the
   * RC, which they cannot do if the page does not show them.
   */
  it('shows what the driver said the vehicle is, next to its papers', async () => {
    get.mockResolvedValue(
      detailWith({
        vehicles: [
          vehicleWith({
            colour: 'White',
            manufactureYear: 2021,
            fuelType: 'CNG',
            imageKey: 'drv_1/vehicle-1.jpg',
            imageUrl: '/v1/admin/vehicles/veh_1/photo',
          }),
        ],
      }),
    );
    renderPage();

    expect(await screen.findByText('White')).toBeInTheDocument();
    expect(screen.getByText('2021')).toBeInTheDocument();
    expect(screen.getByText('cng')).toBeInTheDocument();
    expect(
      screen.getByAltText('KA 01 AB 1234 as the driver photographed it'),
    ).toBeInTheDocument();
  });

  /*
   * A grid of six dashes is true and useless. Saying nobody has been asked yet
   * is what tells the operator whether to chase the driver or the paperwork.
   */
  it('says the vehicle has not been described rather than drawing empty rows', async () => {
    get.mockResolvedValue(
      detailWith({
        vehicles: [vehicleWith({ makeModel: null })],
      }),
    );
    renderPage();

    expect(await screen.findByText(/has not described this vehicle yet/)).toBeInTheDocument();
  });

  it('repeats an earlier rejection, so the same fault is not queried twice', async () => {
    get.mockResolvedValue(
      detailWith({
        driverDocuments: [
          documentWith({ status: 'rejected', rejectionReason: 'The expiry date is cut off.' }),
        ],
      }),
    );
    renderPage();

    expect(await screen.findByText('The expiry date is cut off.')).toBeInTheDocument();
  });
});

describe('deciding on one document', () => {
  const openLicence = async () => {
    const row = (await screen.findByText('Driving licence')).closest('tr');
    fireEvent.click(within(row as HTMLElement).getByRole('button', { name: 'Review' }));
    return screen.findByRole('dialog');
  };

  it('shows the file itself before it asks for a decision', async () => {
    renderPage();
    const dialog = await openLicence();

    expect(
      within(dialog).getByAltText('Driving licence as the driver sent it'),
    ).toBeInTheDocument();
  });

  it('verifies it', async () => {
    renderPage();
    const dialog = await openLicence();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith('/v1/admin/documents/doc_licence/verify');
    });
  });

  it('will not reject without a reason the driver can act on', async () => {
    renderPage();
    const dialog = await openLicence();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm rejection' }));

    expect(await screen.findByText(/Say what is wrong with it/)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('sends the reason with the rejection', async () => {
    renderPage();
    const dialog = await openLicence();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    fireEvent.change(within(dialog).getByLabelText(/Why is this being rejected/), {
      target: { value: 'The photo is cut off at the bottom. Send the whole licence.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm rejection' }));

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith('/v1/admin/documents/doc_licence/reject', {
        reason: 'The photo is cut off at the bottom. Send the whole licence.',
      });
    });
  });
});

describe('deciding on the driver', () => {
  it('refuses to approve while a licence is unverified, and says which', async () => {
    renderPage();

    expect(await screen.findByText(/Verify the driving licence before approving/)).toBeVisible();
    expect(screen.getByRole('button', { name: /Approve driver/ })).toBeDisabled();
  });

  it('approves once the licence is verified', async () => {
    get.mockResolvedValue(
      detailWith({ driverDocuments: [documentWith({ status: 'verified' })] }),
    );
    renderPage();

    const approve = await screen.findByRole('button', { name: /Approve driver/ });
    expect(approve).toBeEnabled();
    fireEvent.click(approve);

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith('/v1/admin/drivers/drv_1/approve');
    });
  });

  it('says nothing is left to do for a driver already approved', async () => {
    get.mockResolvedValue(
      detailWith({
        driver: { ...detailWith().driver, status: 'APPROVED' },
        driverDocuments: [documentWith({ status: 'verified' })],
      }),
    );
    renderPage();

    expect(await screen.findByText(/This driver is approved/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Approve driver/ })).not.toBeInTheDocument();
  });
});

describe('deciding on the vehicle', () => {
  it('offers to sign off the papers only once they are all verified', async () => {
    get.mockResolvedValue(
      detailWith({
        vehicleDocuments: {
          veh_1: [documentWith({ kind: 'RC', documentId: 'doc_rc', status: 'verified' })],
        },
      }),
    );
    renderPage();

    const papers = await screen.findByRole('button', { name: /Papers are in order/ });
    expect(papers).toBeEnabled();
    fireEvent.click(papers);

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith('/v1/admin/vehicles/veh_1/verify-documents');
    });
  });

  it('moves on to approving the vehicle once its papers are signed off', async () => {
    get.mockResolvedValue(
      detailWith({
        vehicles: [{ ...detailWith().vehicles[0]!, status: 'DOCUMENTS_VERIFIED' }],
        vehicleDocuments: {
          veh_1: [documentWith({ kind: 'RC', documentId: 'doc_rc', status: 'verified' })],
        },
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Approve vehicle/ }));

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith('/v1/admin/vehicles/veh_1/approve');
    });
  });

  it('asks nothing further of a vehicle already on the road', async () => {
    get.mockResolvedValue(
      detailWith({ vehicles: [{ ...detailWith().vehicles[0]!, status: 'ACTIVE' }] }),
    );
    renderPage();

    expect(await screen.findByText(/needs nothing further here/)).toBeInTheDocument();
  });
});
