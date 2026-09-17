import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Check, Wrench } from 'lucide-react';
import { api } from '@/shared/api/client';
import { toDisplayMessage } from '@/shared/api/errors';
import { useInstallationFittingQueue, useInstallationPhotos } from '@/shared/api/hooks';
import { queryKeys } from '@/shared/api/queryKeys';
import { env } from '@/shared/config/env';
import type { Assignment, InstallationPhoto, PhotoAngle } from '@/shared/types/domain';
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
import { FormError } from '@/shared/ui/form';

/**
 * The installer's side of AC-06, and the step that had no screen.
 *
 * Approval is what puts a vehicle live, but nothing can be approved until the
 * photos exist, and until now there was nowhere to put them: the review queue
 * lists submitted installations only, so a scheduled one was invisible in the
 * portal while the driver's tracking sat blocked on it.
 */
export function FittingQueue() {
  const query = useInstallationFittingQueue();
  const [fitting, setFitting] = useState<Assignment | null>(null);

  return (
    <>
      <QueryBoundary query={query} errorTitle="Could not load the installation queue">
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="No wraps to fit"
              description="Vehicles appear here once they are assigned to a campaign, and leave once their photos are sent for review."
            />
          ) : (
            <Table caption="Wraps waiting to be fitted">
              <THead>
                <TR>
                  <TH>Vehicle</TH>
                  <TH>Driver</TH>
                  <TH>Photos</TH>
                  <TH>State</TH>
                  <TH align="right">Fit</TH>
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
                    <TD>
                      <FittingBadge assignment={assignment} />
                    </TD>
                    <TD align="right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setFitting(assignment)}
                      >
                        Upload photos
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )
        }
      </QueryBoundary>

      <FitDialog assignment={fitting} onClose={() => setFitting(null)} />
    </>
  );
}

/**
 * Mirrors REQUIRED_ANGLES on the server, which stays the authority: submitting
 * is refused there if an angle is missing, so the worst a stale copy here can
 * do is offer the wrong slot, not let an incomplete wrap through.
 */
const REQUIRED_ANGLES: Record<string, PhotoAngle[]> = {
  CAB: ['FRONT', 'REAR', 'LEFT', 'RIGHT'],
  AUTO: ['REAR', 'LEFT', 'RIGHT'],
};

function FitDialog({
  assignment,
  onClose,
}: {
  assignment: Assignment | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const photos = useInstallationPhotos(assignment?.id ?? null);
  const [uploading, setUploading] = useState<PhotoAngle | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const angles = REQUIRED_ANGLES[assignment?.vehicleCategory ?? ''] ?? [];
  const taken = new Set((photos.data?.items ?? []).map((photo) => photo.angle));
  const complete = angles.length > 0 && angles.every((angle) => taken.has(angle));

  const upload = useMutation({
    mutationFn: async ({ angle, file }: { angle: PhotoAngle; file: File }) => {
      const form = new FormData();
      form.append('file', file);
      await api.upload(`/v1/admin/assignments/${assignment?.id ?? ''}/photos`, form, {
        query: { angle },
      });
    },
    onSuccess: async () => {
      // Both the photo grid and the row's counter move on every upload.
      await queryClient.invalidateQueries({
        queryKey: queryKeys.installations.photos(assignment?.id ?? ''),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.installations.pending() });
    },
  });

  const submit = useMutation({
    mutationFn: () => api.post(`/v1/admin/assignments/${assignment?.id ?? ''}/submit`),
    onSuccess: async () => {
      // It leaves this queue and joins the review one.
      await queryClient.invalidateQueries({ queryKey: queryKeys.installations.pending() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.installations.queue() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all() });
      onClose();
    },
  });

  const busy = upload.isPending || submit.isPending;

  async function choose(angle: PhotoAngle, file: File) {
    setUploading(angle);
    setUploadError(null);
    try {
      await upload.mutateAsync({ angle, file });
    } catch (error) {
      setUploadError(toDisplayMessage(error));
    } finally {
      setUploading(null);
    }
  }

  return (
    <Dialog
      open={assignment !== null}
      onOpenChange={(open) => {
        if (!open && !busy) {
          setUploadError(null);
          onClose();
        }
      }}
      size="lg"
      title="Fit the wrap"
      description={
        assignment
          ? `${assignment.registrationNumber} · ${assignment.driverName}. Photograph every angle, then send it for review — a second person approves it and the vehicle goes live.`
          : undefined
      }
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Close
          </Button>
          <Button onClick={() => submit.mutate()} disabled={busy || !complete}>
            {submit.isPending ? 'Sending…' : 'Send for review'}
          </Button>
        </>
      }
    >
      {assignment?.installation?.status === 'REJECTED' &&
      assignment.installation.rejectionReason ? (
        <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3">
          <p className="text-[13px] font-medium text-rose-900">This wrap was rejected</p>
          <p className="mt-1 text-[13px] text-rose-700">
            {assignment.installation.rejectionReason}
          </p>
        </div>
      ) : null}

      <QueryBoundary query={photos} errorTitle="Could not load photos">
        {(data) => (
          <div className="grid grid-cols-2 gap-3">
            {angles.map((angle) => (
              <AngleSlot
                key={angle}
                angle={angle}
                photo={data.items.find((item) => item.angle === angle) ?? null}
                busy={busy}
                uploading={uploading === angle}
                onChoose={(file) => void choose(angle, file)}
              />
            ))}
          </div>
        )}
      </QueryBoundary>

      {!complete ? (
        <p className="mt-4 text-[12px] text-slate-500">
          Every angle is needed before this can be sent (AC-06.5).
        </p>
      ) : null}

      {uploadError ? <FormError message={uploadError} /> : null}
      {submit.isError && <FormError message={toDisplayMessage(submit.error)} />}
    </Dialog>
  );
}

function AngleSlot({
  angle,
  photo,
  busy,
  uploading,
  onChoose,
}: {
  angle: PhotoAngle;
  photo: InstallationPhoto | null;
  busy: boolean;
  uploading: boolean;
  onChoose: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <figure className="overflow-hidden rounded-xl border border-slate-200">
      {photo ? (
        <img
          src={`${env.apiUrl}/v1/admin/installation-photos/${photo.id}`}
          alt={`${angle.toLowerCase()} of the wrapped vehicle`}
          className="h-40 w-full bg-slate-100 object-cover"
        />
      ) : (
        <div className="flex h-40 w-full items-center justify-center bg-slate-50">
          <Camera className="size-6 text-slate-300" aria-hidden />
        </div>
      )}

      <figcaption className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-slate-600">
          {photo ? <Check className="size-3.5 text-emerald-600" aria-hidden /> : null}
          {ANGLE_LABEL[angle]}
        </span>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          {uploading ? 'Uploading…' : photo ? 'Replace' : 'Add'}
        </Button>

        {/*
          Hidden rather than styled: a file input cannot be made to match the
          buttons beside it, and `capture` lets a phone at the fitting centre
          open the camera instead of the gallery.
        */}
        <input
          ref={input}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          aria-label={`${ANGLE_LABEL[angle]} photo`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Cleared so choosing the same file twice still fires a change.
            event.target.value = '';
            if (file) onChoose(file);
          }}
        />
      </figcaption>
    </figure>
  );
}

function FittingBadge({ assignment }: { assignment: Assignment }) {
  const installation = assignment.installation;
  if (installation?.status === 'REJECTED') return <Badge tone="danger">Redo</Badge>;
  if (installation?.status === 'IN_PROGRESS') return <Badge tone="warning">In progress</Badge>;
  if (assignment.status === 'ASSIGNED') return <Badge tone="neutral">Driver to accept</Badge>;
  return <Badge tone="neutral">Scheduled</Badge>;
}

const ANGLE_LABEL: Record<PhotoAngle, string> = {
  FRONT: 'Front',
  REAR: 'Rear',
  LEFT: 'Left side',
  RIGHT: 'Right side',
};
