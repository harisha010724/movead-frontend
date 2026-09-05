import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { api } from '@/shared/api/client';
import { toDisplayMessage } from '@/shared/api/errors';
import { queryKeys } from '@/shared/api/queryKeys';
import { env } from '@/shared/config/env';
import { formatDateRange, formatINR, formatKm } from '@/shared/format';
import type { AdminCampaign } from '@/shared/types/domain';
import { Badge, Button, Dialog } from '@/shared/ui';
import { FormError } from '@/shared/ui/form';

function creativeKind(campaign: AdminCampaign): 'png' | 'pdf' | null {
  const name = (campaign.creativeFileName ?? campaign.creativeKey ?? '').toLowerCase();
  if (name.endsWith('.png')) return 'png';
  if (name.endsWith('.pdf')) return 'pdf';
  return campaign.creativeKey ? 'png' : null;
}

/**
 * The brief an advertiser submitted. Approval locks it and sends the
 * creative to the printer — it does not skip ahead to installation.
 * The person who created an admin-configured campaign cannot approve it
 * (AC-34.7); the server refuses that, this dialog just shows it.
 */
export function ReviewCampaignDialog({
  campaign,
  onOpenChange,
  onReject,
}: {
  campaign: AdminCampaign | null;
  onOpenChange: (open: boolean) => void;
  onReject: () => void;
}) {
  const queryClient = useQueryClient();

  const approve = useMutation({
    mutationFn: () => api.post(`/v1/admin/campaigns/${campaign?.id ?? ''}/approve`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all() });
      onOpenChange(false);
    },
  });

  const kind = campaign ? creativeKind(campaign) : null;
  const creativeHref = campaign
    ? `${env.apiUrl}/v1/admin/campaigns/${campaign.id}/creative`
    : null;

  return (
    <Dialog
      open={campaign !== null}
      onOpenChange={onOpenChange}
      size="lg"
      title={campaign?.name ?? 'Campaign'}
      description={
        campaign
          ? `${campaign.advertiser.brandName} · ${campaign.city} · ${campaign.vehicleType === 'AUTO' ? 'Auto' : 'Cab'}`
          : undefined
      }
      dismissible={!approve.isPending}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onReject}
            disabled={approve.isPending || !campaign}
          >
            Reject
          </Button>
          <Button
            loading={approve.isPending}
            leadingIcon={<Check className="size-4" />}
            onClick={() => approve.mutate()}
            disabled={!campaign}
          >
            Approve & send to printer
          </Button>
        </>
      }
    >
      {campaign ? (
        <div className="space-y-5">
          <dl className="grid gap-3 sm:grid-cols-2 text-[13px]">
            <div>
              <dt className="text-slate-400">Advertiser</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{campaign.advertiser.legalName}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Brand</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{campaign.brandName}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Duration</dt>
              <dd className="mt-0.5 text-slate-800">
                {formatDateRange(campaign.startDate, campaign.endDate)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Vehicles requested</dt>
              <dd className="numeric mt-0.5 text-slate-800">{campaign.vehicleCount}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Prime</dt>
              <dd className="mt-0.5 text-slate-800">
                {formatKm(Number(campaign.zonePrimeKm ?? 0))} · {formatINR(campaign.zonePrime ?? campaign.budget)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Secondary</dt>
              <dd className="mt-0.5 text-slate-800">
                {formatKm(Number(campaign.zoneSecondaryKm ?? 0))} ·{' '}
                {formatINR(campaign.zoneSecondary ?? '0.00')}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Planned spend</dt>
              <dd className="numeric mt-0.5 font-semibold text-slate-900">
                {formatINR(campaign.budget)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Status</dt>
              <dd className="mt-0.5">
                <Badge tone="warning">In review</Badge>
              </dd>
            </div>
          </dl>

          {kind && creativeHref ? (
            <div>
              <p className="mb-2 text-[13px] font-medium text-slate-700">Creative</p>
              {kind === 'png' ? (
                <img
                  src={creativeHref}
                  alt={`Creative for ${campaign.name}`}
                  className="max-h-72 w-full rounded-xl border border-slate-200 object-contain bg-slate-50"
                />
              ) : (
                <iframe
                  title={`Creative for ${campaign.name}`}
                  src={creativeHref}
                  className="h-72 w-full rounded-xl border border-slate-200 bg-slate-50"
                />
              )}
            </div>
          ) : (
            <p className="text-[13px] text-slate-500">No creative was attached.</p>
          )}

          {approve.isError ? <FormError message={toDisplayMessage(approve.error)} /> : null}
        </div>
      ) : null}
    </Dialog>
  );
}
