import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Car } from 'lucide-react';
import { api } from '@/shared/api/client';
import { toDisplayMessage } from '@/shared/api/errors';
import { useCampaignAssignments } from '@/shared/api/hooks';
import { queryKeys } from '@/shared/api/queryKeys';
import { formatCount } from '@/shared/format';
import type { AdminCampaign } from '@/shared/types/domain';
import {
  Button,
  Dialog,
  EmptyState,
  QueryBoundary,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/shared/ui';
import { FormError, TextareaField } from '@/shared/ui/form';

import { InstallationBadge } from './InstallationQueue';

/**
 * Confirming the advertiser's vehicle request — AC-22.4.
 *
 * The advertiser picked vehicles, but that was a request. This is where it
 * becomes an assignment, and the wording keeps the two apart so nobody reads
 * a shortlist as a booking. Once assigned, the driver sees the campaign and
 * can accept it (AC-22.5).
 */
export function AssignVehiclesDialog({
  campaign,
  onOpenChange,
}: {
  campaign: AdminCampaign | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const assignments = useCampaignAssignments(campaign?.id ?? null);
  const [overrideReason, setOverrideReason] = useState('');
  const [needsOverride, setNeedsOverride] = useState(false);

  const requested = campaign?.requestedVehicleIds ?? [];

  const assign = useMutation({
    mutationFn: () =>
      api.post(`/v1/admin/campaigns/${campaign?.id ?? ''}/vehicles`, {
        vehicleIds: requested,
        ...(overrideReason.trim() ? { overrideReason: overrideReason.trim() } : {}),
      }),
    onSuccess: async () => {
      setOverrideReason('');
      setNeedsOverride(false);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.assignments(campaign?.id ?? ''),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all() });
    },
    // A 400 here means a vehicle failed a requirement, which AC-22.3 says can
    // be overridden with a stated reason rather than silently allowed.
    onError: () => setNeedsOverride(true),
  });

  const alreadyAssigned = assignments.data?.summary.assigned ?? 0;
  const nothingToConfirm = requested.length === 0 || alreadyAssigned >= requested.length;

  return (
    <Dialog
      open={campaign !== null}
      onOpenChange={(open) => {
        if (!open && !assign.isPending) {
          setOverrideReason('');
          setNeedsOverride(false);
        }
        onOpenChange(open);
      }}
      size="lg"
      title="Vehicles on this campaign"
      description={
        campaign
          ? `${campaign.name}. The advertiser requested ${formatCount(requested.length)} vehicles; confirming assigns them and notifies each driver.`
          : undefined
      }
      dismissible={!assign.isPending}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={assign.isPending}
          >
            Close
          </Button>
          <Button
            onClick={() => assign.mutate()}
            disabled={assign.isPending || nothingToConfirm}
          >
            {assign.isPending
              ? 'Assigning…'
              : `Confirm ${formatCount(requested.length)} requested`}
          </Button>
        </>
      }
    >
      {assignments.data && (
        <dl className="mb-4 grid grid-cols-4 gap-3 text-center">
          <Stat label="Requested" value={assignments.data.summary.requested} />
          <Stat label="Assigned" value={assignments.data.summary.assigned} />
          <Stat label="Installing" value={assignments.data.summary.installing} />
          <Stat label="Live" value={assignments.data.summary.active} />
        </dl>
      )}

      <QueryBoundary
        query={assignments}
        errorTitle="Could not load vehicles"
        isEmpty={(data) => data.items.length === 0}
        empty={
          <EmptyState
            icon={Car}
            title="No vehicles assigned yet"
            description="Confirm the advertiser's request to assign vehicles and start the installation workflow."
          />
        }
      >
        {(data) => (
          <Table caption="Assigned vehicles">
            <THead>
              <TR>
                <TH>Vehicle</TH>
                <TH>Driver</TH>
                <TH>Assignment</TH>
                <TH>Installation</TH>
              </TR>
            </THead>
            <TBody>
              {data.items.map((assignment) => (
                <TR key={assignment.id}>
                  <TD>
                    <span className="font-medium text-slate-900">
                      {assignment.registrationNumber}
                    </span>
                    {assignment.overrideReason && (
                      <span className="mt-0.5 block text-[12px] text-amber-700">
                        Override: {assignment.overrideReason}
                      </span>
                    )}
                  </TD>
                  <TD>{assignment.driverName}</TD>
                  <TD className="text-slate-600">{ASSIGNMENT_LABEL[assignment.status]}</TD>
                  <TD>
                    <InstallationBadge assignment={assignment} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </QueryBoundary>

      {needsOverride && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <TextareaField
            label="Assign anyway?"
            hint="One or more vehicles failed a requirement. AC-22.3 allows an override, with a reason that is recorded against the assignment."
            value={overrideReason}
            onChange={(event) => setOverrideReason(event.target.value)}
            rows={2}
          />
        </div>
      )}

      {assign.isError && <FormError message={toDisplayMessage(assign.error)} />}
    </Dialog>
  );
}

const ASSIGNMENT_LABEL = {
  ASSIGNED: 'Awaiting driver',
  ACCEPTED: 'Accepted',
  INSTALLING: 'Installing',
  ACTIVE: 'Live',
  ENDED: 'Ended',
  WITHDRAWN: 'Withdrawn',
} as const;

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
      <dt className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd className="mt-0.5 text-[18px] font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}
