import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/shared/api/client';
import ReportsPage from './ReportsPage';

vi.mock('@/shared/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), download: vi.fn() },
}));

vi.mock('@/shared/layout/Page', () => ({
  Page: ({
    title,
    children,
  }: {
    title: string;
    children: ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock('@/shared/ui/form', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/ui/form')>();
  return {
    ...actual,
    SelectField: ({
      label,
      value,
      onValueChange,
      options,
    }: {
      label: string;
      value: string;
      onValueChange: (value: string) => void;
      options: { value: string; label: string }[];
    }) => (
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
  };
});

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);
const download = vi.mocked(api.download);

const CAMPAIGNS = {
  items: [
    {
      id: 'cmp_1',
      name: 'ABC Summer',
      brandName: 'ABC Foods',
      status: 'ACTIVE',
      city: 'Bengaluru',
      vehicleType: 'AUTO',
      startDate: '2026-09-01',
      endDate: '2026-10-31',
      budget: '500000.00',
      spent: '186400.00',
      remaining: '313600.00',
      vehicleCount: 12,
      verifiedKm: 444.4,
      impressions: 0,
    },
  ],
  page: 1,
  pageSize: 20,
  total: 1,
};

const EXPORT = {
  id: 'exp_1',
  type: 'proof-pack' as const,
  format: 'html' as const,
  campaignId: 'cmp_1',
  campaignName: 'ABC Summer',
  from: '2026-09-01',
  to: '2026-09-30',
  fileName: 'MoveAd-proof-pack-abc-summer-2026-09-01-to-2026-09-30.html',
  contentType: 'text/html; charset=utf-8',
  byteSize: 1200,
  checksum: 'a'.repeat(64),
  generatedAt: '2026-10-01T07:30:00.000Z',
  expiresAt: '2026-10-08T07:30:00.000Z',
  status: 'ready' as const,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReportsPage', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    download.mockReset();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:report'),
      revokeObjectURL: vi.fn(),
    });
    get.mockImplementation(async (path: string) => {
      if (path === '/v1/campaigns') return CAMPAIGNS;
      if (path === '/v1/reports') return { items: [EXPORT] };
      throw new Error(`unexpected GET ${path}`);
    });
  });

  it('generates the proof pack for the selected campaign and downloads it', async () => {
    post.mockResolvedValue(EXPORT);
    download.mockResolvedValue({
      blob: new Blob(['<html></html>'], { type: 'text/html' }),
      fileName: EXPORT.fileName,
      contentType: EXPORT.contentType,
    });

    renderPage();

    expect(await screen.findByRole('button', { name: 'Generate proof pack' })).toBeInTheDocument();
    expect(screen.getAllByText('Campaign proof pack').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Generate proof pack' }));

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith(
        '/v1/reports/export',
        expect.objectContaining({
          type: 'proof-pack',
          campaignId: 'cmp_1',
          format: 'html',
        }),
      );
    });

    await waitFor(() => {
      expect(download).toHaveBeenCalledWith('/v1/reports/exp_1/download');
    });

    expect(
      await screen.findByText(/Ready — the file has downloaded/),
    ).toBeInTheDocument();
  });

  it('lists a recent export and downloads it again', async () => {
    download.mockResolvedValue({
      blob: new Blob(['<html></html>'], { type: 'text/html' }),
      fileName: EXPORT.fileName,
      contentType: EXPORT.contentType,
    });

    renderPage();

    expect(await screen.findByText(/ABC Summer ·/)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Recent exports' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() => {
      expect(download).toHaveBeenCalledWith('/v1/reports/exp_1/download');
    });
  });

  it('asks for a campaign when there are none', async () => {
    get.mockImplementation(async (path: string) => {
      if (path === '/v1/campaigns') return { items: [], page: 1, pageSize: 20, total: 0 };
      if (path === '/v1/reports') return { items: [] };
      throw new Error(`unexpected GET ${path}`);
    });

    renderPage();

    expect(await screen.findByText('No campaigns yet')).toBeInTheDocument();
  });
});
