import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, KeyRound, Save } from 'lucide-react';
import { api } from '@/shared/api/client';
import { ApiError, toDisplayMessage } from '@/shared/api/errors';
import type { AdvertiserListing } from '@/shared/api/hooks';
import { queryKeys } from '@/shared/api/queryKeys';
import { VALIDATION_MODE } from '@/shared/lib/formConfig';
import { Button, Dialog } from '@/shared/ui';
import { FormError, TextField } from '@/shared/ui/form';
import {
  editAdvertiserSchema,
  type EditAdvertiserPayload,
  type EditAdvertiserValues,
} from './advertiserSchema';

/** What the API reports back when an address actually moved. */
interface EmailChange {
  previousEmail: string;
  invitationResent: boolean;
  delivered: boolean;
}

interface UpdatedUser {
  email: string;
  emailChange: EmailChange | null;
}

const EMPTY: EditAdvertiserValues = {
  legalName: '',
  brandName: '',
  billingEmail: '',
  gstin: '',
  pan: '',
  contactName: '',
  contactEmail: '',
};

/**
 * Corrects the account: the company, and the person who signs in to it.
 *
 * Only changed fields are sent, and they go to two endpoints because they are
 * two records. That is not tidiness — a PATCH restating the current values
 * would write an audit entry claiming a correction nobody made, and restating
 * the current email would count as an address change and start ending sessions.
 *
 * Changing the address is the reason this dialog matters. A mistyped email at
 * onboarding is the one mistake the customer cannot report, because the message
 * telling them the account exists went to the typo. What happens next depends
 * on whether they ever got in, so the form says which case applies before the
 * admin commits, and the outcome panel says what actually happened.
 */
export function EditAdvertiserDialog({
  advertiser,
  onOpenChange,
}: {
  advertiser: AdvertiserListing | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  // Keyed by advertiser rather than cleared when the dialog reopens: reopening
  // on a different row already discards it, and clearing it in an effect is a
  // cascading render for something a comparison answers.
  const [reported, setReported] = useState<{
    advertiserId: string;
    change: EmailChange;
  } | null>(null);
  const outcome = reported && reported.advertiserId === advertiser?.id ? reported.change : null;

  /*
   * Three generics: an emptied GSTIN field is `''` going in and `null` coming
   * out, so the form's values and the submitted payload are different types.
   */
  const form = useForm<EditAdvertiserValues, unknown, EditAdvertiserPayload>({
    resolver: zodResolver(editAdvertiserSchema),
    ...VALIDATION_MODE,
    defaultValues: EMPTY,
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = form;

  const contact = advertiser?.primaryUser ?? null;
  const signedUp = contact?.status === 'ACTIVE';

  useEffect(() => {
    if (!advertiser) return;
    reset({
      legalName: advertiser.legalName,
      brandName: advertiser.brandName,
      billingEmail: advertiser.billingEmail,
      gstin: advertiser.gstin ?? '',
      pan: advertiser.pan ?? '',
      contactName: advertiser.primaryUser?.fullName ?? '',
      contactEmail: advertiser.primaryUser?.email ?? '',
    });
  }, [advertiser, reset]);

  // Drives the warning below the field, so the consequence is on screen before
  // the admin commits to it rather than explained afterwards.
  const typedEmail = useWatch({ control, name: 'contactEmail' });
  const movingAddress = contact !== null && typedEmail.trim().toLowerCase() !== contact.email;

  const save = useMutation({
    mutationFn: async (values: EditAdvertiserPayload): Promise<EmailChange | null> => {
      if (!advertiser) return null;

      const company: Record<string, string | null> = {};
      if (values.legalName !== advertiser.legalName) company.legalName = values.legalName;
      if (values.brandName !== advertiser.brandName) company.brandName = values.brandName;
      if (values.billingEmail !== advertiser.billingEmail) {
        company.billingEmail = values.billingEmail;
      }
      // Null is a value here and means remove it, so compare against the
      // advertiser's null rather than treating both as empty.
      if (values.gstin !== (advertiser.gstin ?? null)) company.gstin = values.gstin;
      if (values.pan !== (advertiser.pan ?? null)) company.pan = values.pan;

      if (Object.keys(company).length > 0) {
        await api.patch(`/v1/admin/advertisers/${advertiser.id}`, company);
      }

      if (!contact) return null;

      const person: Record<string, string> = {};
      if (values.contactName !== contact.fullName) person.fullName = values.contactName;
      if (values.contactEmail !== contact.email) person.email = values.contactEmail;

      if (Object.keys(person).length === 0) return null;

      const updated = await api.patch<UpdatedUser>(`/v1/admin/users/${contact.id}`, person);
      return updated.emailChange;
    },
    onSuccess: async (emailChange) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.advertisers.all() });

      // An address change has consequences the admin should read. Anything else
      // is a save, and a dialog that lingers to say "saved" is in the way.
      if (emailChange && advertiser)
        setReported({ advertiserId: advertiser.id, change: emailChange });
      else onOpenChange(false);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.isConflict) {
        setError('contactEmail', {
          message: 'Someone already has an account with this email address',
        });
      }
    },
  });

  if (outcome) {
    return (
      <Dialog
        open
        onOpenChange={onOpenChange}
        title={outcome.invitationResent ? 'Invitation sent again' : 'Sign-in address changed'}
        footer={<Button onClick={() => onOpenChange(false)}>Done</Button>}
      >
        <div
          className={`flex items-start gap-3 rounded-xl p-4 ${
            outcome.delivered ? 'bg-emerald-50' : 'bg-amber-50'
          }`}
        >
          {outcome.delivered ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
          ) : (
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
          )}

          <div
            className={`text-[13px] ${outcome.delivered ? 'text-emerald-900' : 'text-amber-900'}`}
          >
            {outcome.invitationResent ? (
              <>
                <p className="font-medium">
                  {outcome.delivered
                    ? 'A fresh invitation is on its way to the corrected address'
                    : 'The address was corrected, but the email did not send'}
                </p>
                <p className="mt-1">
                  The link sent to {outcome.previousEmail} no longer works.{' '}
                  {outcome.delivered
                    ? 'The new one expires in 72 hours.'
                    : 'Use Resend invitation on the row once mail is working again.'}
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">
                  {outcome.delivered
                    ? `We have told ${outcome.previousEmail} that it no longer signs in`
                    : 'The address changed, but we could not warn the old one'}
                </p>
                <p className="mt-1">
                  Their password still works, and every session on the account has ended, so
                  they will sign in again with the new address.
                </p>
              </>
            )}
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={advertiser !== null}
      onOpenChange={onOpenChange}
      title="Edit advertiser"
      description="Correct the advertiser and the person who signs in."
      dismissible={!save.isPending}
      size="lg"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={save.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-advertiser"
            loading={save.isPending}
            leadingIcon={<Save className="size-4" />}
          >
            Save changes
          </Button>
        </>
      }
    >
      <form
        id="edit-advertiser"
        noValidate
        onSubmit={(event) => void handleSubmit((values) => save.mutate(values))(event)}
        className="space-y-5"
      >
        <div>
          <p className="text-[13px] font-medium text-slate-800">Advertiser</p>
          <p className="mt-1 text-[12px] text-slate-500">
            The two lines in the Advertiser column — what they trade as, then the legal name.
          </p>

          <div className="mt-4 space-y-5">
            <TextField
              label="Brand name"
              required
              autoFocus
              autoComplete="off"
              hint="Shown to drivers and in the portal header."
              error={errors.brandName?.message}
              {...register('brandName')}
            />

            <TextField
              label="Registered legal name"
              required
              autoComplete="off"
              hint="As it appears on the invoice."
              error={errors.legalName?.message}
              {...register('legalName')}
            />
          </div>
        </div>

        {contact ? (
          <div className="border-t border-slate-200 pt-5">
            <p className="text-[13px] font-medium text-slate-800">Primary user</p>
            <p className="mt-1 text-[12px] text-slate-500">
              {signedUp
                ? 'This person has set a password and signs in with the address below.'
                : 'This person has been invited and has not signed in yet.'}
            </p>

            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <TextField
                label="Full name"
                required
                autoComplete="off"
                error={errors.contactName?.message}
                {...register('contactName')}
              />

              <TextField
                label="Email"
                required
                type="email"
                autoComplete="off"
                hint="Their username, and where MoveAd writes to them."
                error={errors.contactEmail?.message}
                {...register('contactEmail')}
              />
            </div>

            {movingAddress ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl bg-amber-50 p-4">
                <KeyRound className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                <p className="text-[12px] text-amber-900">
                  {signedUp ? (
                    <>
                      This changes how they sign in. Their password still works, but every
                      session ends and we email{' '}
                      <span className="font-medium">{contact.email}</span> to say it no longer
                      has access — so if the change is unexpected, they hear about it.
                    </>
                  ) : (
                    <>
                      Their invitation will be sent again to the new address, and the link
                      already sent to <span className="font-medium">{contact.email}</span> will
                      stop working.
                    </>
                  )}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="border-t border-slate-200 pt-5">
          <p className="text-[13px] font-medium text-slate-800">Billing</p>
          <p className="mt-1 text-[12px] text-slate-500">
            Where invoices go, and the identifiers finance will need.
          </p>

          <div className="mt-4 space-y-5">
            <TextField
              label="Billing email"
              required
              type="email"
              autoComplete="off"
              hint="Not a login."
              error={errors.billingEmail?.message}
              {...register('billingEmail')}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="GSTIN"
                autoComplete="off"
                className="uppercase"
                hint="Clear the field to remove it."
                error={errors.gstin?.message}
                {...register('gstin')}
              />

              <TextField
                label="PAN"
                autoComplete="off"
                className="uppercase"
                error={errors.pan?.message}
                {...register('pan')}
              />
            </div>
          </div>
        </div>

        {/* A conflict is already reported under the contact email field. */}
        {save.isError && !(save.error instanceof ApiError && save.error.isConflict) ? (
          <FormError message={toDisplayMessage(save.error)} />
        ) : null}
      </form>
    </Dialog>
  );
}
