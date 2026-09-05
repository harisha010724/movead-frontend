import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImageOff } from 'lucide-react';
import { api } from '@/shared/api/client';
import { toDisplayMessage } from '@/shared/api/errors';
import { useInstallationPhotos, useInstallationQueue } from '@/shared/api/hooks';
import { queryKeys } from '@/shared/api/queryKeys';
import { env } from '@/shared/config/env';
import type { Assignment } from '@/shared/types/domain';
import {
  Badge,
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

/**
 * The installation approval queue — AC-06.8 to AC-06.12.
 *
 * Approving here is the only thing that puts a vehicle live on a campaign, so
 * the reviewer sees the photos before the button, not after it. Rejection
 * requires a reason because the driver has to be told what to redo.
 */
export function InstallationQueue() {
  const query = useInstallationQueue();
  const [reviewing, setReviewing] = useState<Assignment | null>(null);

  return (
    <>
      <QueryBoundary query={query} errorTitle="Could not load the installation queue">
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState
              icon={ImageOff}
              title="Nothing waiting"
              description="Installations appear here once an installer has uploaded every required photo."
            />
          ) : (
            <Table caption="Installations awaiting review">
              <THead>
                <TR>
                  <TH>Vehicle</TH>
                  <TH>Driver</TH>
                  <TH>Photos</TH>
                  <TH>Submitted</TH>
                  <TH align="right">Review</TH>
                </TR>
              </THead>
              <TBody>
                {data.items.map((assignment) => (
                  <TR key={assignment.id}>
                    <TD>
                      <span className="font-medium text-slate-900">
                        {assignment.registrationNumber}
                      </span>
                    </TD>
                    <TD>{assignment.driverName}</TD>
                    <TD numeric>
                      {assignment.installation?.photoCount ?? 0} /{' '}
                      {assignment.installation?.requiredCount ?? 0}
                    </TD>
                    <TD>{formatWhen(assignment.installation?.submittedAt ?? null)}</TD>
                    <TD align="right">
                      <Button size="sm" variant="secondary" onClick={() => setReviewing(assignment)}>
                        Review
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )
        }
      </QueryBoundary>

      <ReviewDialog assignment={reviewing} onClose={() => setReviewing(null)} />
    </>
  );
}

function ReviewDialog({
  assignment,
  onClose,
}: {
  assignment: Assignment | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const photos = useInstallationPhotos(assignment?.id ?? null);
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const settle = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.installations.queue() });
    await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all() });
    setReason('');
    setRejecting(false);
    onClose();
  };

  const approve = useMutation({
    mutationFn: () => api.post(`/v1/admin/assignments/${assignment?.id ?? ''}/approve`),
    onSuccess: settle,
  });

  const reject = useMutation({
    mutationFn: () =>
      api.post(`/v1/admin/assignments/${assignment?.id ?? ''}/reject`, { reason }),
    onSuccess: settle,
  });

  const busy = approve.isPending || reject.isPending;

  return (
    <Dialog
      open={assignment !== null}
      onOpenChange={(open) => {
        if (!open && !busy) {
          setReason('');
          setRejecting(false);
          onClose();
        }
      }}
      size="lg"
      title="Review installation"
      description={
        assignment
          ? `${assignment.registrationNumber} · ${assignment.driverName}. Approving puts this vehicle live and it starts earning.`
          : undefined
      }
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          {rejecting ? (
            <Button
              variant="danger"
              onClick={() => reject.mutate()}
              disabled={busy || reason.trim().length < 10}
            >
              {reject.isPending ? 'Rejecting…' : 'Confirm rejection'}
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setRejecting(true)} disabled={busy}>
                Reject
              </Button>
              <Button onClick={() => approve.mutate()} disabled={busy}>
                {approve.isPending ? 'Approving…' : 'Approve and go live'}
              </Button>
            </>
          )}
        </>
      }
    >
      <QueryBoundary query={photos} errorTitle="Could not load photos">
        {(data) => (
          <div className="grid grid-cols-2 gap-3">
            {data.items.map((photo) => (
              <figure key={photo.id} className="overflow-hidden rounded-xl border border-slate-200">
                <img
                  src={`${env.apiUrl}/v1/admin/installation-photos/${photo.id}`}
                  alt={`${photo.angle.toLowerCase()} of the wrapped vehicle`}
                  className="h-40 w-full bg-slate-100 object-cover"
                />
                <figcaption className="px-3 py-2 text-[12px] font-medium text-slate-600">
                  {ANGLE_LABEL[photo.angle]}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </QueryBoundary>

      {rejecting && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <TextareaField
            label="Why is this being rejected?"
            hint="The driver sees this, so say what to redo."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
          />
        </div>
      )}

      {approve.isError && <FormError message={toDisplayMessage(approve.error)} />}
      {reject.isError && <FormError message={toDisplayMessage(reject.error)} />}
    </Dialog>
  );
}

const ANGLE_LABEL = {
  FRONT: 'Front',
  REAR: 'Rear',
  LEFT: 'Left side',
  RIGHT: 'Right side',
} as const;

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Badge for a per-vehicle installation, used in the campaign assignment table. */
export function InstallationBadge({ assignment }: { assignment: Assignment }) {
  const installation = assignment.installation;
  if (!installation) return <Badge tone="neutral">Not scheduled</Badge>;

  switch (installation.status) {
    case 'APPROVED':
      return <Badge tone="success">Live</Badge>;
    case 'SUBMITTED':
      return <Badge tone="warning">Awaiting review</Badge>;
    case 'REJECTED':
      return <Badge tone="danger">Rejected</Badge>;
    case 'IN_PROGRESS':
      return (
        <Badge tone="neutral">
          {installation.photoCount} / {installation.requiredCount} photos
        </Badge>
      );
    default:
      return <Badge tone="neutral">Scheduled</Badge>;
  }
}
