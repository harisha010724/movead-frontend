import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { toDisplayMessage } from '@/shared/api/errors';
import {
  useBrandingProofEligible,
  useBrandingProofWaiting,
} from '@/shared/api/hooks';
import { queryKeys } from '@/shared/api/queryKeys';
import type { BrandingProof, BrandingProofEligible } from '@/shared/types/domain';
import {
  Badge,
  Button,
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
 * Ask a live vehicle for wrap photos. The photos themselves go to the
 * advertiser — there is no ops approve/reject step.
 */
export function BrandingProofQueue() {
  const waiting = useBrandingProofWaiting();
  const eligible = useBrandingProofEligible();

  return (
    <div className="grid gap-8">
      <section>
        <h3 className="mb-3 text-[13px] font-semibold text-slate-800">Asked, not yet sent</h3>
        <QueryBoundary query={waiting} errorTitle="Could not load outstanding requests">
          {(data) =>
            data.items.length === 0 ? (
              <p className="text-[13px] text-slate-500">No open requests.</p>
            ) : (
              <Table caption="Outstanding wrap-photo requests">
                <THead>
                  <TR>
                    <TH>Vehicle</TH>
                    <TH>Driver</TH>
                    <TH>Status</TH>
                    <TH>Due</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.items.map((proof) => (
                    <TR key={proof.id}>
                      <TD className="font-medium text-slate-900">{proof.registrationNumber}</TD>
                      <TD>{proof.driverName}</TD>
                      <TD>
                        <ProofBadge status={proof.status} />
                      </TD>
                      <TD>{formatWhen(proof.dueAt)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )
          }
        </QueryBoundary>
      </section>

      <section>
        <h3 className="mb-3 text-[13px] font-semibold text-slate-800">Request photos</h3>
        <p className="mb-3 text-[13px] text-slate-500">
          Ask a live vehicle to photograph the wrap. The driver has 24 hours
          before earning pauses. Sent photos appear on the advertiser campaign.
        </p>
        <QueryBoundary query={eligible} errorTitle="Could not load live vehicles">
          {(data) =>
            data.items.length === 0 ? (
              <p className="text-[13px] text-slate-500">
                Every live vehicle already has a check open or none is on the road.
              </p>
            ) : (
              <EligibleTable items={data.items} />
            )
          }
        </QueryBoundary>
      </section>
    </div>
  );
}

function EligibleTable({ items }: { items: BrandingProofEligible[] }) {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const request = useMutation({
    mutationFn: (assignmentId: string) =>
      api.post(`/v1/admin/assignments/${assignmentId}/branding-proofs`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.brandingProofs.waiting() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.brandingProofs.eligible() });
      setBusyId(null);
    },
    onError: (err) => {
      setError(toDisplayMessage(err));
      setBusyId(null);
    },
  });

  return (
    <>
      <Table caption="Live vehicles that can be asked for wrap photos">
        <THead>
          <TR>
            <TH>Vehicle</TH>
            <TH>Driver</TH>
            <TH>Campaign</TH>
            <TH align="right">Ask</TH>
          </TR>
        </THead>
        <TBody>
          {items.map((row) => (
            <TR key={row.assignmentId}>
              <TD className="font-medium text-slate-900">{row.registrationNumber}</TD>
              <TD>{row.driverName}</TD>
              <TD>{row.campaignName}</TD>
              <TD align="right">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busyId === row.assignmentId}
                  onClick={() => {
                    setError(null);
                    setBusyId(row.assignmentId);
                    request.mutate(row.assignmentId);
                  }}
                >
                  {busyId === row.assignmentId ? 'Asking…' : 'Request photos'}
                </Button>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {error ? <FormError message={error} /> : null}
    </>
  );
}

function ProofBadge({ status }: { status: BrandingProof['status'] }) {
  if (status === 'REJECTED') return <Badge tone="danger">Redo</Badge>;
  if (status === 'IN_PROGRESS') return <Badge tone="warning">In progress</Badge>;
  return <Badge tone="neutral">Requested</Badge>;
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
