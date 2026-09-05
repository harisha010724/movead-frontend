import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Download, FileText } from 'lucide-react';
import { api } from '@/shared/api/client';
import { toDisplayMessage } from '@/shared/api/errors';
import { Page } from '@/shared/layout/Page';
import { Button, Card, CardBody, CardHeader } from '@/shared/ui';
import { FormError, SelectField } from '@/shared/ui/form';
import { RANGE_LABELS, resolveRange, type RangePreset } from '@/shared/lib/dateRange';

type ReportType = 'km-detail' | 'zone-summary' | 'vehicle-summary' | 'billing-statement';

const REPORTS: { value: ReportType; label: string; description: string }[] = [
  {
    value: 'km-detail',
    label: 'Kilometre detail',
    description: 'Every billed segment with its vehicle, timestamp, zone and rate.',
  },
  {
    value: 'zone-summary',
    label: 'Zone summary',
    description: 'Distance and spend grouped by pricing zone.',
  },
  {
    value: 'vehicle-summary',
    label: 'Vehicle summary',
    description: 'Per-vehicle distance and zone mix, anonymised.',
  },
  {
    value: 'billing-statement',
    label: 'Billing statement',
    description: 'Wallet movements reconciled against verified distance.',
  },
];

export default function ReportsPage() {
  const [type, setType] = useState<ReportType>('km-detail');
  const [preset, setPreset] = useState<RangePreset>('last30');

  /*
   * Reports are generated asynchronously. A kilometre-detail export over a
   * month can be hundreds of thousands of rows, which is a background job and
   * a download link, not an HTTP response the browser waits on.
   */
  const requestExport = useMutation({
    mutationFn: () => {
      const range = resolveRange(preset);
      return api.post<{ jobId: string }>('/v1/reports/export', {
        type,
        from: range.from,
        to: range.to,
        format: 'csv',
      });
    },
  });

  const selected = REPORTS.find((r) => r.value === type);

  return (
    <Page
      title="Reports"
      greeting="Export the underlying data behind every figure on your dashboard"
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Generate a report" />
          <CardBody className="space-y-5">
            <SelectField
              label="Report"
              value={type}
              onValueChange={(v) => setType(v as ReportType)}
              options={REPORTS.map((r) => ({ value: r.value, label: r.label }))}
              {...(selected?.description ? { hint: selected.description } : {})}
            />

            <SelectField
              label="Period"
              value={preset}
              onValueChange={(v) => setPreset(v as RangePreset)}
              options={(Object.keys(RANGE_LABELS) as RangePreset[]).map((p) => ({
                value: p,
                label: RANGE_LABELS[p],
              }))}
            />

            {requestExport.isSuccess ? (
              <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-800">
                Your report is being prepared. You will receive an email with a download link when
                it is ready.
              </p>
            ) : null}

            {requestExport.isError ? (
              <FormError message={toDisplayMessage(requestExport.error)} />
            ) : null}

            <Button
              loading={requestExport.isPending}
              leadingIcon={<Download className="size-4" />}
              onClick={() => requestExport.mutate()}
            >
              Generate CSV
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent exports" />
          <CardBody>
            <div className="flex items-start gap-3 text-sm text-slate-500">
              <FileText className="mt-0.5 size-4 shrink-0 text-slate-400" />
              <p>
                Completed exports appear here for seven days, then expire. Links are signed and
                single-use.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    </Page>
  );
}
