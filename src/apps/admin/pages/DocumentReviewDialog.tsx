import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ExternalLink, FileText, ImageOff } from 'lucide-react';
import { z } from 'zod';
import { api } from '@/shared/api/client';
import { toDisplayMessage } from '@/shared/api/errors';
import { queryKeys } from '@/shared/api/queryKeys';
import { env } from '@/shared/config/env';
import { formatDate, formatDateTime } from '@/shared/format';
import { VALIDATION_MODE } from '@/shared/lib/formConfig';
import type { DocumentChecklistItem } from '@/shared/types/domain';
import { Badge, Button, Dialog } from '@/shared/ui';
import { FormError, TextareaField } from '@/shared/ui/form';
import { toast } from '@/shared/ui/toast';
import { Can } from '@/shared/auth/guards';
import { ADMIN_PERMISSIONS as PERMISSIONS } from '@/shared/auth/permissions';
import { isPdf, KIND_LABEL, STATUS_LABEL, STATUS_TONE } from './documentPresentation';

const schema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, 'Say what is wrong with it — the driver only sees this')
    .max(500, 'Keep the reason under 500 characters'),
});

type Values = z.infer<typeof schema>;

/**
 * Look at a document, then decide on it — AC-05.3 and AC-32.3.
 *
 * The file and the two buttons are in the same place on purpose. An operator
 * who has to open a document in one screen and record the decision in another
 * will eventually record a decision about the wrong document.
 *
 * Rejection demands a reason because the driver's only route back is to be
 * told what to redo; the mobile app prints it verbatim on their checklist.
 */
export function DocumentReviewDialog({
  document,
  onClose,
}: {
  /** Null when nothing is being reviewed, which is what closes the dialog. */
  document: DocumentChecklistItem | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    ...VALIDATION_MODE,
    defaultValues: { reason: '' },
  });

  /*
   * Cleared on the way out rather than on the way in. Every route out of the
   * dialog goes through here, so the next document opens on a blank form
   * without an effect watching the prop.
   */
  const close = () => {
    setRejecting(false);
    form.reset({ reason: '' });
    onClose();
  };

  const settle = async (title: string) => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.drivers.all() });
    toast.success({ title });
    close();
  };

  const verify = useMutation({
    mutationFn: () => api.post(`/v1/admin/documents/${document?.documentId ?? ''}/verify`),
    onSuccess: () => settle('Document verified'),
  });

  const reject = useMutation({
    mutationFn: (values: Values) =>
      api.post(`/v1/admin/documents/${document?.documentId ?? ''}/reject`, {
        reason: values.reason,
      }),
    onSuccess: () => settle('Document rejected — the driver has been told why'),
  });

  const busy = verify.isPending || reject.isPending;
  const decided = document ? document.status !== 'uploaded' : false;

  return (
    <Dialog
      open={document !== null}
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
      size="lg"
      title={document ? KIND_LABEL[document.kind] : 'Document'}
      description={
        document
          ? `Sent ${formatDateTime(document.uploadedAt)}${
              document.expiresOn ? ` · expires ${formatDate(document.expiresOn)}` : ''
            }`
          : undefined
      }
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Close
          </Button>
          {rejecting ? (
            <Button
              type="submit"
              form="reject-document"
              variant="danger"
              loading={reject.isPending}
              disabled={verify.isPending}
            >
              Confirm rejection
            </Button>
          ) : (
            <Can permission={PERMISSIONS.documentVerify}>
              <Button variant="secondary" onClick={() => setRejecting(true)} disabled={busy}>
                Reject
              </Button>
              <Button
                onClick={() => verify.mutate()}
                loading={verify.isPending}
                leadingIcon={<Check className="size-4" />}
              >
                Verify
              </Button>
            </Can>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {document ? (
            <Badge tone={STATUS_TONE[document.status]}>{STATUS_LABEL[document.status]}</Badge>
          ) : null}
          {decided ? (
            <span className="text-[12px] text-slate-500">
              Already decided. Verifying or rejecting again overwrites the earlier decision.
            </span>
          ) : null}
        </div>

        {document?.rejectionReason ? (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-[13px] text-rose-900">
            <span className="font-medium">Previously rejected: </span>
            {document.rejectionReason}
          </p>
        ) : null}

        {document?.documentId ? (
          <DocumentPreview
            // Remounts per document, so a previous load failure is not
            // inherited by the next one.
            key={document.documentId}
            documentId={document.documentId}
            contentType={document.contentType}
            label={KIND_LABEL[document.kind]}
          />
        ) : null}

        {rejecting ? (
          <form
            id="reject-document"
            noValidate
            onSubmit={(event) =>
              void form.handleSubmit((values) => reject.mutate(values))(event)
            }
            className="border-t border-slate-100 pt-4"
          >
            <TextareaField
              label="Why is this being rejected?"
              required
              autoFocus
              rows={3}
              placeholder="The licence photo is cut off at the bottom — send one showing the expiry date."
              hint="The driver reads this on their phone. At least 10 characters."
              error={form.formState.errors.reason?.message}
              {...form.register('reason')}
            />
          </form>
        ) : null}

        {verify.isError ? <FormError message={toDisplayMessage(verify.error)} /> : null}
        {reject.isError ? <FormError message={toDisplayMessage(reject.error)} /> : null}
      </div>
    </Dialog>
  );
}

/**
 * The file itself.
 *
 * Same-origin through the dev proxy, so the session cookie rides along on the
 * `<img>` and `<object>` requests without any of the token juggling the mobile
 * app needs. A PDF gets the browser's own viewer rather than a rendering
 * library: it is a licence scan, not a document that needs annotating.
 */
function DocumentPreview({
  documentId,
  contentType,
  label,
}: {
  documentId: string;
  contentType: string | null;
  label: string;
}) {
  const [broken, setBroken] = useState(false);
  const href = `${env.apiUrl}/v1/admin/documents/${documentId}/file`;

  if (broken) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
        <ImageOff className="size-5 text-slate-400" aria-hidden />
        <p className="text-[13px] text-slate-600">
          The file could not be loaded. Do not decide on this until it can be seen.
        </p>
      </div>
    );
  }

  return (
    <figure className="overflow-hidden rounded-xl border border-slate-200">
      {isPdf(contentType) ? (
        <object data={href} type="application/pdf" className="h-[26rem] w-full bg-slate-100">
          {/*
            Shown by browsers with no built-in PDF viewer, which is most mobile
            ones — an operator on a tablet still needs a way through.
          */}
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <FileText className="size-5 text-slate-400" aria-hidden />
            <p className="text-[13px] text-slate-600">This browser cannot show the PDF inline.</p>
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-brand-600 inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline"
            >
              Open in a new tab
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </div>
        </object>
      ) : (
        <img
          src={href}
          alt={`${label} as the driver sent it`}
          onError={() => setBroken(true)}
          className="max-h-[26rem] w-full bg-slate-100 object-contain"
        />
      )}
      <figcaption className="flex items-center justify-between gap-3 border-t border-slate-100 px-3 py-2">
        <span className="text-[12px] text-slate-500">{contentType ?? 'Unknown file type'}</span>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-600 hover:text-slate-900 hover:underline"
        >
          Full size
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </figcaption>
    </figure>
  );
}