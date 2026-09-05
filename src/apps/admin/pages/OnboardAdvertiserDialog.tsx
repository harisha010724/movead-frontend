import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Mail, Send, ShieldCheck } from 'lucide-react';
import { api } from '@/shared/api/client';
import { ApiError, toDisplayMessage } from '@/shared/api/errors';
import { queryKeys } from '@/shared/api/queryKeys';
import { VALIDATION_MODE } from '@/shared/lib/formConfig';
import { Button, Dialog } from '@/shared/ui';
import { FormError, TextField } from '@/shared/ui/form';
import {
  onboardAdvertiserSchema,
  type OnboardAdvertiserPayload,
  type OnboardAdvertiserValues,
} from './advertiserSchema';

interface OnboardedResponse {
  advertiser: { id: string; brandName: string; legalName: string };
  user: { id: string; email: string; fullName: string } | null;
  invitationEmailed: boolean;
}

interface Onboarded {
  brandName: string;
  contactEmail: string;
  emailed: boolean;
}

const EMPTY: OnboardAdvertiserValues = {
  legalName: '',
  brandName: '',
  billingEmail: '',
  gstin: '',
  pan: '',
  contactName: '',
  contactEmail: '',
};

/**
 * AC-32.2: there is no advertiser self-registration, so this dialog is the only
 * way an advertiser account comes into existence.
 *
 * It asks for no password. The contact is emailed a single-use link and picks
 * their own, which means nobody at MoveAd ever knows a customer's credential
 * and none is sitting in a mailbox in plain text — worth the extra screen for
 * an account that is about to hold a funded wallet.
 */
export function OnboardAdvertiserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [onboarded, setOnboarded] = useState<Onboarded | null>(null);

  /*
   * Three generics because the schema does not round-trip: an untouched GSTIN
   * input is `''` going in and `null` coming out. Without the third, the form's
   * values and what `handleSubmit` hands over are assumed to be the same type.
   */
  const form = useForm<OnboardAdvertiserValues, unknown, OnboardAdvertiserPayload>({
    resolver: zodResolver(onboardAdvertiserSchema),
    ...VALIDATION_MODE,
    defaultValues: EMPTY,
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = form;

  // Reset only once the closing animation cannot show the cleared form.
  useEffect(() => {
    if (open) return;
    const timer = setTimeout(() => {
      reset(EMPTY);
      setOnboarded(null);
    }, 200);
    return () => clearTimeout(timer);
  }, [open, reset]);

  /*
   * One request. The API creates the organisation and its first login in a
   * single transaction, so an email that is already registered leaves no
   * half-made advertiser behind for the admin to trip over on the retry.
   */
  const create = useMutation({
    mutationFn: (values: OnboardAdvertiserPayload) =>
      api.post<OnboardedResponse>('/v1/admin/advertisers', {
        legalName: values.legalName,
        brandName: values.brandName,
        billingEmail: values.billingEmail,
        gstin: values.gstin,
        pan: values.pan,
        user: { email: values.contactEmail, fullName: values.contactName },
      }),
    onSuccess: async (created, values) => {
      setOnboarded({
        brandName: created.advertiser.brandName,
        contactEmail: created.user?.email ?? values.contactEmail,
        emailed: created.invitationEmailed,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.advertisers.all() });
    },
    onError: (error) => {
      /*
       * The only thing unique here is the contact's email, and only the server
       * knows it. Put the message on that input rather than in the form-level
       * banner, where the admin has to work out which of two addresses clashed
       * — and it is never the billing one, which is not an account.
       */
      if (error instanceof ApiError && error.isConflict) {
        setError('contactEmail', {
          message: 'Someone already has an account with this email address',
        });
      }
    },
  });

  const startAnother = () => {
    reset(EMPTY);
    setOnboarded(null);
    create.reset();
  };

  if (onboarded) {
    return (
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title="Advertiser onboarded"
        description={`${onboarded.brandName} has an account, and an invitation is on its way.`}
        footer={
          <>
            <Button variant="secondary" onClick={startAnother}>
              Onboard another
            </Button>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </>
        }
      >
        {onboarded.emailed ? (
          <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
            <div className="text-[13px] text-emerald-900">
              <p className="font-medium">Invitation sent to {onboarded.contactEmail}</p>
              <p className="mt-1 text-emerald-800">
                It carries a link to choose a password, and expires in 72 hours.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
            <div className="text-[13px] text-amber-900">
              <p className="font-medium">The account exists, but the email did not send</p>
              <p className="mt-1 text-amber-800">
                Nothing is lost — the invitation is valid. Use{' '}
                <span className="font-medium">Resend invitation</span> on the row once mail is
                working again.
              </p>
            </div>
          </div>
        )}

        <div className="mt-4">
          <p className="text-[13px] font-medium text-slate-800">What happens next</p>
          <ol className="mt-2.5 space-y-2.5 text-[13px] text-slate-600">
            {[
              'They follow the link and choose their own password. We never see it.',
              'They sign in to the advertiser portal and can plan a campaign straight away.',
              'The account stays in Onboarding until its wallet is funded.',
              'Nothing can be spent until then, so there is no rush on this step.',
            ].map((step, index) => (
              <li key={step} className="flex gap-2.5">
                <span className="numeric mt-px grid size-5 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Onboard advertiser"
      description="Open the account and invite their first user to set a password."
      dismissible={!create.isPending}
      size="lg"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="onboard-advertiser"
            loading={create.isPending}
            leadingIcon={<Send className="size-4" />}
          >
            Create and invite
          </Button>
        </>
      }
    >
      <form
        id="onboard-advertiser"
        noValidate
        onSubmit={(event) => void handleSubmit((values) => create.mutate(values))(event)}
        className="space-y-5"
      >
        <TextField
          label="Registered legal name"
          required
          autoFocus
          autoComplete="off"
          placeholder="Zephyr Beverages Private Limited"
          hint="As it appears on the invoice."
          error={errors.legalName?.message}
          {...register('legalName')}
        />

        <TextField
          label="Brand name"
          required
          autoComplete="off"
          placeholder="Zephyr"
          hint="What they trade as. Shown to drivers and in the portal header."
          error={errors.brandName?.message}
          {...register('brandName')}
        />

        <TextField
          label="Billing email"
          required
          type="email"
          autoComplete="off"
          placeholder="accounts@zephyr.example"
          hint="Where invoices go. Not a login."
          error={errors.billingEmail?.message}
          {...register('billingEmail')}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="GSTIN"
            autoComplete="off"
            placeholder="29ABCDE1234F1Z5"
            className="uppercase"
            hint="Optional — add it before the first invoice."
            error={errors.gstin?.message}
            {...register('gstin')}
          />

          <TextField
            label="PAN"
            autoComplete="off"
            placeholder="ABCDE1234F"
            className="uppercase"
            hint="Optional."
            error={errors.pan?.message}
            {...register('pan')}
          />
        </div>

        <div className="border-t border-slate-200 pt-5">
          <p className="text-[13px] font-medium text-slate-800">Their first user</p>
          <p className="mt-1 text-[12px] text-slate-500">
            The person who will sign in and run campaigns. They can add colleagues later.
          </p>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <TextField
              label="Full name"
              required
              autoComplete="off"
              placeholder="Priya Menon"
              error={errors.contactName?.message}
              {...register('contactName')}
            />

            <TextField
              label="Email"
              required
              type="email"
              autoComplete="off"
              placeholder="priya@zephyr.example"
              hint="Their username, and where the invitation goes."
              error={errors.contactEmail?.message}
              {...register('contactEmail')}
            />
          </div>
        </div>

        {/* A conflict is already reported under the contact email field. */}
        {create.isError && !(create.error instanceof ApiError && create.error.isConflict) ? (
          <FormError message={toDisplayMessage(create.error)} />
        ) : null}

        <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
          <p className="text-[11px] text-slate-500">
            You are not setting a password. They get a single-use link that expires in 72 hours
            and choose their own, so no credential is ever sent by email or known to anyone
            here.
          </p>
        </div>

        <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
          <Mail className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
          <p className="text-[11px] text-slate-500">
            The invitation is signed with your name, so their first message from MoveAd comes
            from the person they have been speaking to.
          </p>
        </div>
      </form>
    </Dialog>
  );
}
