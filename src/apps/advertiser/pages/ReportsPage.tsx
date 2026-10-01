import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, FileText } from 'lucide-react';

import { api } from '@/shared/api/client';
import { toDisplayMessage } from '@/shared/api/errors';
import { useCampaigns, useReportExports } from '@/shared/api/hooks';
import { queryKeys } from '@/shared/api/queryKeys';
import { formatDateRange, formatDateTime } from '@/shared/format';
import { RANGE_LABELS, resolveRange, type RangePreset } from '@/shared/lib/dateRange';
import { Page } from '@/shared/layout/Page';
import type { Campaign, ReportExport, ReportType } from '@/shared/types/domain';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  QueryBoundary,
  Skeleton,
} from '@/shared/ui';
import { FormError, SelectField } from '@/shared/ui/form';

const REPORTS: { value: ReportType; label: string; description: string }[] = [
  {
    value: 'proof-pack',
    label: 'Campaign proof pack',
    description:
      'The document to send to finance or a client: verified kilometres, charge, zone mix, readability, and the modelled-impressions appendix with the working.',
  },
  {
    value: 'billing-statement',
    label: 'Billing statement',
    description: 'Verified kilometres charged in this period, by zone, against the campaign budget.',
  },
  {
    value: 'zone-summary',
    label: 'Zone summary',
    description: 'Distance, spend and modelled impressions grouped by pricing zone.',
  },
  {
    value: 'vehicle-summary',
    label: 'Vehicle summary',
    description: 'Per-vehicle distance and zone mix. Plates are anonymised to the last four digits.',
  },
  {
    value: 'km-detail',
    label: 'Kilometre detail',
    description: 'Every billed segment with its vehicle, timestamp, zone and rate.',
  },
];

const REPORT_LABEL: Record<ReportType, string> = Object.fromEntries(
  REPORTS.map((report) => [report.value, report.label]),
) as Record<ReportType, string>;

function saveFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function ReportsSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-3" aria-busy="true" aria-label="Loading reports">
      <Card className="lg:col-span-2">
        <CardHeader title="Generate a report" />
        <CardBody className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-40" />
        </CardBody>
      </Card>
      <Card className="flex max-h-[min(32rem,calc(100vh-12rem))] flex-col overflow-hidden">
        <CardHeader title="Recent exports" />
        <CardBody className="scroll-slim min-h-0 flex-1 space-y-3 overflow-y-auto">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardBody>
      </Card>
    </div>
  );
}

export default function ReportsPage() {
  const campaigns = useCampaigns();

  return (
    <Page
      title="Reports"
      greeting="A dated proof of what ran, and the CSVs behind every figure"
    >
      <QueryBoundary
        query={campaigns}
        loading={<ReportsSkeleton />}
        errorTitle="Could not load campaigns"
      >
        {(data) => <ReportsBody campaigns={data.items} />}
      </QueryBoundary>
    </Page>
  );
}

function ReportsBody({ campaigns }: { campaigns: Campaign[] }) {
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '');
  const [type, setType] = useState<ReportType>('proof-pack');
  const [preset, setPreset] = useState<RangePreset>('last30');
  const selected = campaigns.find((campaign) => campaign.id === campaignId) ?? campaigns[0] ?? null;
  const exports = useReportExports();
  const queryClient = useQueryClient();

  const requestExport = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Choose a campaign first.');
      const range = resolveRange(preset, selected.startDate);
      return api.post<ReportExport>('/v1/reports/export', {
        type,
        campaignId: selected.id,
        from: range.from,
        to: range.to,
        format: type === 'proof-pack' ? 'html' : 'csv',
      });
    },
    onSuccess: async (exported) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.reports.list() });
      const file = await api.download(`/v1/reports/${exported.id}/download`);
      saveFile(file.blob, file.fileName);
    },
  });

  const download = useMutation({
    mutationFn: async (id: string) => {
      const file = await api.download(`/v1/reports/${id}/download`);
      saveFile(file.blob, file.fileName);
    },
  });

  const selectedReport = REPORTS.find((report) => report.value === type);

  if (campaigns.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={FileText}
          title="No campaigns yet"
          description="A proof pack and the CSVs behind it appear here once you have a campaign to report on."
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader
          title="Generate a report"
          description="The proof pack is the document. The CSVs are the same billed kilometres, as a spreadsheet."
        />
        <CardBody className="space-y-5">
          <SelectField
            label="Campaign"
            value={selected?.id ?? ''}
            onValueChange={setCampaignId}
            options={campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))}
          />

          <SelectField
            label="Report"
            value={type}
            onValueChange={(value) => setType(value as ReportType)}
            options={REPORTS.map((report) => ({ value: report.value, label: report.label }))}
            {...(selectedReport?.description ? { hint: selectedReport.description } : {})}
          />

          <SelectField
            label="Period"
            value={preset}
            onValueChange={(value) => setPreset(value as RangePreset)}
            options={(Object.keys(RANGE_LABELS) as RangePreset[]).map((value) => ({
              value,
              label: RANGE_LABELS[value],
            }))}
          />

          {requestExport.isSuccess ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-800">
              Ready — the file has downloaded. It stays in Recent exports for seven days.
            </p>
          ) : null}

          {requestExport.isError ? <FormError message={toDisplayMessage(requestExport.error)} /> : null}

          <Button
            loading={requestExport.isPending}
            leadingIcon={<Download className="size-4" />}
            onClick={() => requestExport.mutate()}
          >
            {type === 'proof-pack' ? 'Generate proof pack' : 'Generate CSV'}
          </Button>
        </CardBody>
      </Card>

      <Card className="flex max-h-[min(32rem,calc(100vh-12rem))] flex-col overflow-hidden">
        <CardHeader
          className="shrink-0"
          title="Recent exports"
          description="Kept for seven days, then they expire."
        />
        <CardBody className="scroll-slim min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <QueryBoundary
            query={exports}
            loading={
              <div className="space-y-3" aria-busy="true" aria-label="Loading exports">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            }
            errorTitle="Could not load recent exports"
          >
            {(data) =>
              data.items.length === 0 ? (
                <div className="flex items-start gap-3 text-sm text-slate-500">
                  <FileText className="mt-0.5 size-4 shrink-0 text-slate-400" />
                  <p>Nothing exported yet. Generate a proof pack and it will land here.</p>
                </div>
              ) : (
                <ul className="space-y-3" aria-label="Recent exports">
                  {data.items.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3"
                    >
                      <p className="text-sm font-medium text-slate-900">
                        {REPORT_LABEL[item.type]}
                      </p>
                      <p className="mt-0.5 text-[13px] text-slate-500">
                        {item.campaignName} · {formatDateRange(item.from, item.to)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {formatDateTime(item.generatedAt)} · expires {formatDateTime(item.expiresAt)}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2"
                        loading={download.isPending && download.variables === item.id}
                        leadingIcon={<Download className="size-3.5" />}
                        onClick={() => download.mutate(item.id)}
                      >
                        Download
                      </Button>
                    </li>
                  ))}
                </ul>
              )
            }
          </QueryBoundary>
        </CardBody>
      </Card>
    </div>
  );
}
