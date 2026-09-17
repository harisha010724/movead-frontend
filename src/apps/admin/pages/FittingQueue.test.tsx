import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/shared/api/client';
import type { Assignment, InstallationPhoto } from '@/shared/types/domain';
import { FittingQueue } from './FittingQueue';

vi.mock('@/shared/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), upload: vi.fn() },
}));

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);
const upload = vi.mocked(api.upload);

function assignmentWith(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: 'asg_1',
    campaignId: 'cmp_1',
    vehicleId: 'veh_1',
    driverId: 'drv_1',
    registrationNumber: 'KA02AB1234',
    driverName: 'Sujay',
    // An auto needs three angles rather than a cab's four (AC-06.4).
    vehicleCategory: 'AUTO',
    status: 'ACCEPTED',
    assignedAt: '2026-09-10T04:00:00.000Z',
    acceptedAt: '2026-09-10T05:00:00.000Z',
    activatedAt: null,
    overrideReason: null,
    installation: {
      status: 'SCHEDULED',
      photoCount: 0,
      requiredCount: 3,
      rejectionReason: null,
      submittedAt: null,
      reviewedAt: null,
    },
    ...overrides,
  };
}

function photoWith(angle: InstallationPhoto['angle']): InstallationPhoto {
  return {
    id: `pho_${angle.toLowerCase()}`,
    angle,
    fileName: `${angle.toLowerCase()}.jpg`,
    uploadedAt: '2026-09-10T06:00:00.000Z',
  };
}

/** The queue and the photo grid are two calls; route each to its own answer. */
function serve(items: Assignment[], photos: InstallationPhoto[]) {
  get.mockImplementation((path: string) =>
    Promise.resolve(path.endsWith('/photos') ? { items: photos } : { items }),
  );
}

function renderQueue() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={client}>
      <FittingQueue />
    </QueryClientProvider>,
  );
}

function jpeg(name: string): File {
  return new File(['x'], name, { type: 'image/jpeg' });
}

beforeEach(() => {
  vi.clearAllMocks();
  serve([assignmentWith()], []);
  post.mockResolvedValue({});
  upload.mockResolvedValue({});
});

describe('the wraps waiting to be fitted', () => {
  it('lists the vehicle, whose it is and how far along it is', async () => {
    renderQueue();

    expect(await screen.findByText('KA02AB1234')).toBeInTheDocument();
    expect(screen.getByText('Sujay')).toBeInTheDocument();
    expect(screen.getByText('0 / 3')).toBeInTheDocument();
  });

  it('says so plainly when there is no work, rather than showing an empty table', async () => {
    serve([], []);
    renderQueue();

    expect(await screen.findByText('No wraps to fit')).toBeInTheDocument();
  });

  /* AC-06.4: only the angles this vehicle type needs, or an installer photographs
     a side that will be refused on submission. */
  it('asks for the angles the vehicle type needs and no others', async () => {
    renderQueue();

    fireEvent.click(await screen.findByRole('button', { name: 'Upload photos' }));

    expect(await screen.findByLabelText('Rear photo')).toBeInTheDocument();
    expect(screen.getByLabelText('Left side photo')).toBeInTheDocument();
    expect(screen.getByLabelText('Right side photo')).toBeInTheDocument();
    expect(screen.queryByLabelText('Front photo')).not.toBeInTheDocument();
  });

  /*
   * AC-06.5 is enforced on the server, but a button that fails is worse than
   * one that waits: the installer is standing at the vehicle and can still fix
   * it.
   */
  it('will not send for review until every angle is there', async () => {
    serve([assignmentWith()], [photoWith('REAR'), photoWith('LEFT')]);
    renderQueue();

    fireEvent.click(await screen.findByRole('button', { name: 'Upload photos' }));
    // Two of the three angles arrived, so the slots settle before the check:
    // a button asserted disabled while its photos are still loading proves
    // nothing.
    expect(await screen.findAllByRole('button', { name: 'Replace' })).toHaveLength(2);

    expect(screen.getByRole('button', { name: 'Send for review' })).toBeDisabled();
  });

  it('sends it once the last angle is there', async () => {
    serve([assignmentWith()], [photoWith('REAR'), photoWith('LEFT'), photoWith('RIGHT')]);
    renderQueue();

    fireEvent.click(await screen.findByRole('button', { name: 'Upload photos' }));
    expect(await screen.findAllByRole('button', { name: 'Replace' })).toHaveLength(3);

    const send = screen.getByRole('button', { name: 'Send for review' });
    expect(send).toBeEnabled();

    fireEvent.click(send);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/v1/admin/assignments/asg_1/submit'),
    );
  });

  it('uploads against the angle it was asked for', async () => {
    renderQueue();

    fireEvent.click(await screen.findByRole('button', { name: 'Upload photos' }));
    fireEvent.change(await screen.findByLabelText('Left side photo'), {
      target: { files: [jpeg('left.jpg')] },
    });

    await waitFor(() =>
      expect(upload).toHaveBeenCalledWith(
        '/v1/admin/assignments/asg_1/photos',
        expect.any(FormData),
        { query: { angle: 'LEFT' } },
      ),
    );
  });

  /* AC-06.9: the installer has to be told what to redo, not just that it failed. */
  it('shows the reviewer’s reason on a wrap that came back', async () => {
    serve(
      [
        assignmentWith({
          installation: {
            status: 'REJECTED',
            photoCount: 3,
            requiredCount: 3,
            rejectionReason: 'The rear photo is too dark to read the plate.',
            submittedAt: '2026-09-10T06:00:00.000Z',
            reviewedAt: '2026-09-10T07:00:00.000Z',
          },
        }),
      ],
      [photoWith('REAR'), photoWith('LEFT'), photoWith('RIGHT')],
    );
    renderQueue();

    fireEvent.click(await screen.findByRole('button', { name: 'Upload photos' }));

    expect(
      await screen.findByText('The rear photo is too dark to read the plate.'),
    ).toBeInTheDocument();
  });
});
