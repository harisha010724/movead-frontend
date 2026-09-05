import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, FileWarning } from 'lucide-react';
import { api } from '@/shared/api/client';
import { toDisplayMessage } from '@/shared/api/errors';
import { useDriverDetail } from '@/shared/api/hooks';
import { queryKeys } from '@/shared/api/queryKeys';
import { Page } from '@/shared/layout/Page';
import { adminPath } from '@/shared/auth/portals';
import { Can } from '@/shared/auth/guards';
import { ADMIN_PERMISSIONS as PERMISSIONS } from '@/shared/auth/permissions';
import { env } from '@/shared/config/env';
import { formatDate, formatDateTime, formatRegistration } from '@/shared/format';
import type {
  AdminDriverDetail,
  AdminVehicle,
  DocumentChecklistItem,
} from '@/shared/types/domain';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  QueryBoundary,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/shared/ui';
import { toast } from '@/shared/ui/toast';
import { DocumentReviewDialog } from './DocumentReviewDialog';
import { KIND_LABEL, STATUS_LABEL, STATUS_TONE } from './documentPresentation';
import { ReasonDialog } from './ReasonDialog';

/**
 * The document review screen — AC-05 and AC-32.3.
 *
 * Verification is two decisions that people tend to confuse: each document is
 * verified or rejected on its own, and only then is the driver approved and
 * the vehicle put on the road. The page keeps them apart, and refuses to offer
 * the second until the first is finished, because the API refuses too and
 * finding that out from a 422 teaches nothing.
 */
export default function DriverReviewPage() {
  const { id } = useParams<{ id: string }>();
  const query = useDriverDetail(id);
  const [reviewing, setReviewing] = useState<DocumentChecklistItem | null>(null);
  const [rejectingDriver, setRejectingDriver] = useState(false);
  const afterRejection = useSettle('Sent back to the driver');

  return (
    <Page title="Driver verification" greeting="Look at what they sent, then decide">
      <Link
        to={adminPath('/drivers')}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        All drivers
      </Link>

      <QueryBoundary query={query} errorTitle="Could not load this driver">
        {(detail) => (
          <div className="space-y-5">
            <IdentityCard detail={detail} />

            <DocumentsCard
              title="Driver documents"
              description="Their own papers. All of them must be verified before the driver can be approved."
              documents={detail.driverDocuments}
              onReview={setReviewing}
              footer={
                <DriverDecision
                  detail={detail}
                  onReject={() => setRejectingDriver(true)}
                />
              }
            />

            {detail.vehicles.length === 0 ? (
              <Card>
                <CardBody className="pt-5">
                  <p className="text-[13px] text-slate-500">
                    No vehicle has been added yet, so there are no vehicle papers to check.
                  </p>
                </CardBody>
              </Card>
            ) : (
              detail.vehicles.map((vehicle) => (
                <DocumentsCard
                  key={vehicle.id}
                  title={formatRegistration(vehicle.registrationNumber)}
                  description={`${vehicle.category === 'AUTO' ? 'Auto' : 'Cab'}${
                    vehicle.makeModel ? ` · ${vehicle.makeModel}` : ''
                  }`}
                  badge={
                    <Badge tone={vehicleTone(vehicle.status)}>{humanise(vehicle.status)}</Badge>
                  }
                  documents={detail.vehicleDocuments[vehicle.id] ?? []}
                  onReview={setReviewing}
                  above={<VehicleDescription vehicle={vehicle} />}
                  footer={
                    <VehicleDecision
                      vehicle={vehicle}
                      documents={detail.vehicleDocuments[vehicle.id] ?? []}
                    />
                  }
                />
              ))
            )}
          </div>
        )}
      </QueryBoundary>

      <DocumentReviewDialog document={reviewing} onClose={() => setReviewing(null)} />

      <ReasonDialog
        open={rejectingDriver}
        onOpenChange={setRejectingDriver}
        title="Send this back to the driver"
        description="They return to pending and can correct what is wrong and resubmit."
        confirmLabel="Reject and notify"
        hint="The driver reads this on their phone. At least 10 characters."
        placeholder="The licence photo is too blurred to read the number. Send a clearer one."
        path={`/v1/admin/drivers/${id ?? ''}/reject`}
        onDone={afterRejection}
      />
    </Page>
  );
}

/** Invalidate the driver cache and say what happened, after any decision. */
function useSettle(title: string): () => Promise<void> {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.drivers.all() });
    toast.success({ title });
  };
}

function IdentityCard({ detail }: { detail: AdminDriverDetail }) {
  const { driver } = detail;
  const reason = driver.suspendedReason ?? driver.rejectionReason;

  return (
    <Card>
      <CardHeader
        title={driver.name}
        description={`${driver.mobile} · joined ${formatDate(driver.joinedAt)}`}
        action={<Badge tone={driverTone(driver.status)}>{humanise(driver.status)}</Badge>}
      />
      <CardBody>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <Fact label="City" value={driver.city} />
          <Fact label="Area" value={driver.location?.label ?? '—'} />
          <Fact
            label="Vehicle"
            value={
              detail.vehicles[0]
                ? formatRegistration(detail.vehicles[0].registrationNumber)
                : 'None yet'
            }
          />
          <Fact label="Documents sent" value={countSent(detail)} />
        </dl>

        {reason ? (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
            <span className="font-medium">Last decision: </span>
            {reason}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-slate-500">{label}</dt>
      <dd className="mt-0.5 truncate text-[13px] font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function DocumentsCard({
  title,
  description,
  badge,
  documents,
  onReview,
  above,
  footer,
}: {
  title: string;
  description: string;
  badge?: ReactNode;
  documents: DocumentChecklistItem[];
  onReview: (document: DocumentChecklistItem) => void;
  /** Sits above the checklist. The vehicle's own details, where there are any. */
  above?: ReactNode;
  footer: ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} {...(badge ? { action: badge } : {})} />
      {above ? <CardBody className="pb-0">{above}</CardBody> : null}
      <CardBody className="pb-0">
        <Table caption={`${title} checklist`}>
          <THead>
            <TR>
              <TH>Document</TH>
              <TH>Status</TH>
              <TH>Sent</TH>
              <TH>Expires</TH>
              <TH align="right">
                <span className="sr-only">Review</span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {documents.map((document) => (
              <TR key={document.kind}>
                <TD className="font-medium text-slate-900">
                  {KIND_LABEL[document.kind]}
                  {document.isMandatory ? null : (
                    <span className="ml-2 text-[12px] font-normal text-slate-400">optional</span>
                  )}
                </TD>
                <TD>
                  <Badge tone={STATUS_TONE[document.status]}>
                    {STATUS_LABEL[document.status]}
                  </Badge>
                  {document.rejectionReason ? (
                    <p className="mt-1 max-w-[22rem] text-[12px] text-slate-500">
                      {document.rejectionReason}
                    </p>
                  ) : null}
                </TD>
                <TD className="text-slate-600">{formatDateTime(document.uploadedAt)}</TD>
                <TD className="text-slate-600">
                  {document.expiresOn ? formatDate(document.expiresOn) : '—'}
                </TD>
                <TD align="right">
                  {document.documentId ? (
                    <Can permission={PERMISSIONS.documentRead}>
                      <Button size="sm" variant="secondary" onClick={() => onReview(document)}>
                        {document.status === 'uploaded' ? 'Review' : 'View'}
                      </Button>
                    </Can>
                  ) : (
                    <span className="text-[12px] text-slate-400">Nothing sent</span>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardBody>
      <CardFooter className="mt-5">{footer}</CardFooter>
    </Card>
  );
}

function DriverDecision({
  detail,
  onReject,
}: {
  detail: AdminDriverDetail;
  onReject: () => void;
}) {
  const settle = useSettle('Driver approved');
  const outstanding = unverified(detail.driverDocuments);

  const approve = useMutation({
    mutationFn: () => api.post(`/v1/admin/drivers/${detail.driver.id}/approve`),
    onSuccess: settle,
  });

  if (detail.driver.status === 'APPROVED') {
    return (
      <Note tone="done">This driver is approved. Their papers are all verified.</Note>
    );
  }

  return (
    <Decision
      blocker={
        outstanding.length > 0
          ? `Verify ${listKinds(outstanding)} before approving them.`
          : null
      }
      error={approve.isError ? toDisplayMessage(approve.error) : null}
    >
      <Can permission={PERMISSIONS.driverApprove}>
        <Button variant="secondary" onClick={onReject} disabled={approve.isPending}>
          Reject
        </Button>
        <Button
          onClick={() => approve.mutate()}
          loading={approve.isPending}
          disabled={outstanding.length > 0}
          leadingIcon={<Check className="size-4" />}
        >
          Approve driver
        </Button>
      </Can>
    </Decision>
  );
}

/**
 * What the driver said their vehicle is, and a photo of it.
 *
 * None of it comes from onboarding — AC-04 asks an admin for a plate and a
 * type over a phone call and stops, so every field here was typed by the
 * driver on their own phone (UI-015). It sits above the checklist because
 * that is the order the operator works in: read the RC, then check that the
 * make, colour and year on it are the ones the driver claimed.
 *
 * Absent rather than blank when the driver has filled nothing in. A grid of
 * six dashes says "this vehicle has no details", which is true and useless;
 * one line saying nobody has been asked yet says what to do about it.
 */
function VehicleDescription({ vehicle }: { vehicle: AdminVehicle }) {
  const facts = [
    { label: 'Make / model', value: vehicle.makeModel },
    { label: 'Colour', value: vehicle.colour },
    { label: 'Year', value: vehicle.manufactureYear?.toString() ?? null },
    { label: 'Fuel', value: vehicle.fuelType ? humanise(vehicle.fuelType) : null },
    { label: 'Body type', value: vehicle.bodyType },
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact.value));

  if (facts.length === 0 && !vehicle.imageUrl) {
    return (
      <p className="text-[13px] text-slate-500">
        The driver has not described this vehicle yet. They add the make, colour, year, fuel and a
        photo from the app.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      {vehicle.imageUrl ? (
        <img
          src={`${env.apiUrl}${vehicle.imageUrl}`}
          alt={`${formatRegistration(vehicle.registrationNumber)} as the driver photographed it`}
          className="h-32 w-full shrink-0 rounded-xl border border-slate-200 bg-slate-100 object-cover sm:w-48"
        />
      ) : null}

      <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        {facts.map((fact) => (
          <Fact key={fact.label} label={fact.label} value={fact.value} />
        ))}
      </dl>
    </div>
  );
}

/**
 * A vehicle is approved in two steps, and the API enforces the order: papers
 * verified first, then the vehicle itself. Only the step that is actually
 * available is offered, so the button on screen is one that will work.
 */
function VehicleDecision({
  vehicle,
  documents,
}: {
  vehicle: AdminVehicle;
  documents: DocumentChecklistItem[];
}) {
  const [rejecting, setRejecting] = useState(false);
  const settleVerified = useSettle('Vehicle papers verified');
  const settleApproved = useSettle('Vehicle approved — it can be put on a campaign');
  const settleRejected = useSettle('Vehicle sent back');
  const outstanding = unverified(documents);

  const verifyPapers = useMutation({
    mutationFn: () => api.post(`/v1/admin/vehicles/${vehicle.id}/verify-documents`),
    onSuccess: settleVerified,
  });

  const approve = useMutation({
    mutationFn: () => api.post(`/v1/admin/vehicles/${vehicle.id}/approve`),
    onSuccess: settleApproved,
  });

  const beyondApproval = vehicle.status !== 'PENDING' && vehicle.status !== 'DOCUMENTS_VERIFIED';

  return (
    <>
      {beyondApproval ? (
        <Note tone={vehicle.status === 'REJECTED' ? 'blocked' : 'done'}>
          {vehicle.status === 'REJECTED'
            ? (vehicle.rejectionReason ?? 'This vehicle was rejected.')
            : `This vehicle is ${humanise(vehicle.status)} and needs nothing further here.`}
        </Note>
      ) : (
        <Decision
          blocker={
            vehicle.status === 'PENDING' && outstanding.length > 0
              ? `Verify ${listKinds(outstanding)} before the papers can be signed off.`
              : null
          }
          error={
            verifyPapers.isError
              ? toDisplayMessage(verifyPapers.error)
              : approve.isError
                ? toDisplayMessage(approve.error)
                : null
          }
        >
          <Can permission={PERMISSIONS.vehicleApprove}>
            <Button
              variant="secondary"
              onClick={() => setRejecting(true)}
              disabled={verifyPapers.isPending || approve.isPending}
            >
              Reject
            </Button>
            {vehicle.status === 'PENDING' ? (
              <Button
                onClick={() => verifyPapers.mutate()}
                loading={verifyPapers.isPending}
                disabled={outstanding.length > 0}
                leadingIcon={<Check className="size-4" />}
              >
                Papers are in order
              </Button>
            ) : (
              <Button
                onClick={() => approve.mutate()}
                loading={approve.isPending}
                leadingIcon={<Check className="size-4" />}
              >
                Approve vehicle
              </Button>
            )}
          </Can>
        </Decision>
      )}

      <ReasonDialog
        open={rejecting}
        onOpenChange={setRejecting}
        title="Reject this vehicle"
        description={`${formatRegistration(vehicle.registrationNumber)} goes back to the driver to correct.`}
        confirmLabel="Reject vehicle"
        hint="The driver reads this. At least 10 characters."
        placeholder="The registration certificate is for a different plate than the one registered."
        path={`/v1/admin/vehicles/${vehicle.id}/reject`}
        onDone={settleRejected}
      />
    </>
  );
}

/** The blocker line and the buttons, laid out the same way in every card. */
function Decision({
  blocker,
  error,
  children,
}: {
  blocker: string | null;
  error: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-[13px] text-slate-500">
        {blocker ? (
          <>
            <FileWarning className="size-4 shrink-0 text-amber-500" aria-hidden />
            {blocker}
          </>
        ) : (
          'Everything needed is verified.'
        )}
      </p>
      <div className="flex items-center gap-2.5">{children}</div>
      {error ? <p className="w-full text-[13px] text-rose-600">{error}</p> : null}
    </div>
  );
}

function Note({ tone, children }: { tone: 'done' | 'blocked'; children: ReactNode }) {
  return (
    <p
      className={`text-[13px] ${tone === 'blocked' ? 'text-rose-700' : 'text-emerald-700'}`}
    >
      {children}
    </p>
  );
}

function unverified(documents: DocumentChecklistItem[]): DocumentChecklistItem[] {
  return documents.filter((item) => item.isMandatory && item.status !== 'verified');
}

function listKinds(documents: DocumentChecklistItem[]): string {
  const names = documents.map((item) => KIND_LABEL[item.kind].toLowerCase());
  if (names.length === 1) return `the ${names[0]}`;
  return `the ${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

function countSent(detail: AdminDriverDetail): string {
  const all = [...detail.driverDocuments, ...Object.values(detail.vehicleDocuments).flat()];
  const sent = all.filter((item) => item.status !== 'missing').length;
  return `${sent} of ${all.length}`;
}

function humanise(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase();
}

function driverTone(status: AdminDriverDetail['driver']['status']) {
  if (status === 'APPROVED') return 'success' as const;
  if (status === 'SUSPENDED') return 'danger' as const;
  if (status === 'PENDING') return 'warning' as const;
  return 'info' as const;
}

function vehicleTone(status: AdminVehicle['status']) {
  if (status === 'SUSPENDED') return 'danger' as const;
  if (status === 'PENDING') return 'warning' as const;
  if (status === 'APPROVED' || status === 'AVAILABLE' || status === 'ACTIVE') {
    return 'success' as const;
  }
  return 'info' as const;
}
