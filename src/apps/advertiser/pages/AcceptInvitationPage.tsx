import { useForm } from 'react-hook-form';
import { Navigate, useParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Car, Check, Mail } from 'lucide-react';
import { api } from '@/shared/api/client';
import { ApiError, toDisplayMessage } from '@/shared/api/errors';
import { AuthLayout } from '@/shared/auth/AuthLayout';
import { cacheSessionUser, type LoginResponse } from '@/shared/auth/session';
import { LOGIN_PATH, portalPath, type Portal } from '@/shared/auth/portals';
import { useAuth } from '@/shared/auth/useAuth';
import { VALIDATION_MODE } from '@/shared/lib/formConfig';
import { Button, Spinner } from '@/shared/ui';
import { FormError, TextField } from '@/shared/ui/form';
import {
  acceptInvitationSchema,
  type AcceptInvitationValues,
} from '@/apps/admin/pages/advertiserSchema';

interface Invitation {
  email: string;
  fullName: string;
  organisation: string | null;
  expiresAt: string;
  audience: Portal;
}

const PANEL = {
  icon: Car,
  wordmark: 'MoveAd',
  tagline: 'Reach. Track. Measure.',
  pitch:
    'Your campaign travels the city on autos and cabs. You pay only for the distance we can prove it covered.',
  points: ['Live vehicle tracking', 'Zone-by-zone billing', 'Auditable GPS trails'],
} as const;

/**
 * Where an invitation link lands. The customer's first screen of MoveAd.
 *
 * It exists because we do not email passwords. The account was created by
 * operations, but the credential is chosen here by the person who will use it,
 * so nobody at MoveAd has ever known it and there is nothing in their mailbox
 * worth stealing once the link is spent.
 *
 * They are signed in immediately afterwards using the password they just typed,
 * which is still in memory. That reuses the ordinary login path — its lockout,
 * its audience stamping, its cookie naming — rather than having a public
 * endpoint mint a session, and it saves a brand-new customer from being bounced
 * to a sign-in form to retype what they chose ten seconds ago.
 */
export default function AcceptInvitationPage() {
  const { token = '' } = useParams();
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuth();

  const invitation = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => api.get<Invitation>(`/v1/invitations/${token}`),
    // A single-use token is not worth retrying, and a 422 is a final answer.
    retry: false,
    staleTime: Infinity,
  });

  const form = useForm<AcceptInvitationValues>({
    resolver: zodResolver(acceptInvitationSchema),
    ...VALIDATION_MODE,
    defaultValues: { password: '', confirm: '' },
  });

  const accept = useMutation({
    mutationFn: async (values: AcceptInvitationValues) => {
      await api.post(`/v1/invitations/${token}/accept`, { password: values.password });

      const result = await api.post<LoginResponse>('/v1/auth/login', {
        email: invitation.data?.email ?? '',
        password: values.password,
      });

      if (result.status === 'authenticated') {
        cacheSessionUser(queryClient, result.user);
      }
    },
  });

  if (accept.isSuccess && isAuthenticated && user) {
    return <Navigate to={portalPath(user.portal)} replace />;
  }

  if (invitation.isPending) {
    return (
      <AuthLayout {...PANEL} footnote="">
        <div className="flex items-center gap-3 text-[14px] text-slate-500">
          <Spinner className="size-4" />
          Checking your invitation
        </div>
      </AuthLayout>
    );
  }

  if (invitation.isError) {
    return (
      <AuthLayout
        {...PANEL}
        footnote="Need help? Email support@movead.in and we will sort it out."
      >
        {/* One sign-in URL, so a driver's dead invite link and an advertiser's
            send them to the same place. */}
        <DeadLink error={invitation.error} loginHref={LOGIN_PATH} />
      </AuthLayout>
    );
  }

  const { email, fullName, organisation } = invitation.data;
  const firstName = fullName.trim().split(/\s+/)[0] ?? fullName;

  return (
    <AuthLayout
      {...PANEL}
      footnote="Choosing your own password means nobody at MoveAd has ever seen it — not even the person who set up your account."
    >
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Welcome, {firstName}.
      </h1>
      <p className="mt-1.5 text-[14px] leading-relaxed text-slate-500">
        {organisation ? (
          <>
            Choose a password and the{' '}
            <span className="font-medium text-slate-700">{organisation}</span> dashboard is
            yours.
          </>
        ) : (
          'Choose a password to finish setting up your account.'
        )}
      </p>

      <div className="mt-6 flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
        <Mail className="size-4 shrink-0 text-slate-400" aria-hidden />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            You will sign in as
          </p>
          <p className="truncate text-[14px] font-medium text-slate-900">{email}</p>
        </div>
      </div>

      <form
        noValidate
        onSubmit={(event) => void form.handleSubmit((values) => accept.mutate(values))(event)}
        className="mt-6 space-y-4"
      >
        {/* Off-screen, so a password manager saves the pair rather than just a password. */}
        <input type="email" value={email} autoComplete="username" readOnly hidden />

        <TextField
          label="Choose a password"
          type="password"
          autoComplete="new-password"
          autoFocus
          hint="At least 12 characters. A phrase you can remember beats a short scramble."
          className="h-12 rounded-xl text-[15px]"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />

        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          className="h-12 rounded-xl text-[15px]"
          error={form.formState.errors.confirm?.message}
          {...form.register('confirm')}
        />

        {accept.isError ? <FormError message={toDisplayMessage(accept.error)} /> : null}

        <Button
          type="submit"
          className="h-12 w-full rounded-xl text-[15px]"
          loading={accept.isPending}
        >
          Set password and sign in
        </Button>
      </form>

      <ul className="mt-6 space-y-2">
        {[
          'Plan a campaign and see the reach before you commit.',
          'Pick the autos and cabs that carry it.',
          'Follow every verified kilometre on a live map.',
        ].map((point) => (
          <li key={point} className="flex items-start gap-2.5 text-[13px] text-slate-500">
            <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-brand-50">
              <Check className="size-2.5 text-brand-600" aria-hidden />
            </span>
            {point}
          </li>
        ))}
      </ul>
    </AuthLayout>
  );
}

/**
 * The three ways a link can be dead, each with the sentence that actually helps.
 *
 * Worth the branching: "ask for a new one", "you already did this, just sign
 * in" and "check for a more recent email" send someone to three different
 * places, and a single generic message sends all three to support.
 */
function DeadLink({ error, loginHref }: { error: unknown; loginHref: string }) {
  const code = error instanceof ApiError ? error.code : '';

  const { title, body, action } = {
    invitation_used: {
      title: 'You have already set your password',
      body: 'This link only works once. Sign in with the password you chose.',
      action: 'Go to sign in',
    },
    invitation_expired: {
      title: 'This invitation has expired',
      body: 'Links last 72 hours. Ask your MoveAd contact to send a new one — your account is still there and nothing is lost.',
      action: null,
    },
    invitation_superseded: {
      title: 'There is a newer invitation',
      body: 'A more recent email was sent to you, and only the latest link works. Check your inbox for it.',
      action: null,
    },
  }[code] ?? {
    title: 'This link is not valid',
    body: 'It may have been copied incompletely. Try opening it from the email again, or ask your MoveAd contact to resend it.',
    action: null,
  };

  return (
    <>
      <div className="grid size-11 place-items-center rounded-xl bg-amber-50">
        <AlertCircle className="size-5 text-amber-600" aria-hidden />
      </div>

      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-1.5 text-[14px] leading-relaxed text-slate-500">{body}</p>

      {action ? (
        <Button asChild className="mt-7 h-12 w-full rounded-xl text-[15px]">
          <a href={loginHref}>{action}</a>
        </Button>
      ) : null}
    </>
  );
}
