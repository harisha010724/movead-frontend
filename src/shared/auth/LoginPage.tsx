import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Car } from 'lucide-react';
import { api } from '@/shared/api/client';
import { toDisplayMessage } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/useAuth';
import { VALIDATION_MODE } from '@/shared/lib/formConfig';
import { Button, toast } from '@/shared/ui';
import { FullPageSpinner } from '@/shared/ui/Spinner';
import { TextField } from '@/shared/ui/form';
import { AuthLayout } from './AuthLayout';
import { GoogleMark } from './GoogleMark';
import { isHomePortal, portalLabel, portalPath, type Portal } from './portals';
import type { AuthUserPayload } from './authContext';
import { beginSession, type LoginResponse } from './session';
import { EnrolAuthenticator } from './EnrolAuthenticator';
import {
  credentialsSchema,
  mfaSchema,
  type CredentialsValues,
  type MfaValues,
} from './authSchemas';

interface Enrolment {
  secret: string;
  otpauthUri: string;
}

/** What the credentials step left behind for the code step to use. */
interface Challenge {
  token: string;
  audience: Portal;
  enrolment: Enrolment | null;
}

/**
 * The one sign-in screen, for all three audiences.
 *
 * There is a single credentials endpoint and the account carries its own
 * audience, so the destination is a fact the server already holds — asking the
 * user to pick a portal first only gave them a way to be wrong. The copy is
 * therefore deliberately audience-neutral: this page cannot know who is
 * reading it, and guessing would be worse than not saying.
 *
 * Whether a second factor is required is also the server's call. Admin TOTP is
 * mandatory (ADM-001) and advertiser TOTP is optional, and the login response
 * says which, so the same form covers both without knowing who signed in.
 */
export function LoginPage() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [signedIn, setSignedIn] = useState<AuthUserPayload | null>(null);

  const credentialsForm = useForm<CredentialsValues>({
    resolver: zodResolver(credentialsSchema),
    ...VALIDATION_MODE,
    defaultValues: { email: '', password: '' },
  });

  const mfaForm = useForm<MfaValues>({
    resolver: zodResolver(mfaSchema),
    ...VALIDATION_MODE,
    defaultValues: { code: '' },
  });

  /**
   * Success writes the `user` from the login (or MFA) body into the session
   * cache. Failure is the 401 on this request — there is no follow-up `/me`.
   */
  const login = useMutation({
    mutationFn: (values: CredentialsValues) =>
      api.post<LoginResponse>('/v1/auth/login', values),
    onSuccess: async (result) => {
      if (result.status === 'authenticated') {
        beginSession(queryClient, result);
        setSignedIn(result.user);
        return;
      }

      // An admin signing in for the first time has no authenticator yet, and
      // MFA is mandatory for them, so the secret is fetched here and shown
      // alongside the code field rather than in a separate step the user could
      // abandon halfway.
      const enrolment =
        result.status === 'mfa_enrolment_required'
          ? await api.post<Enrolment>('/v1/auth/mfa/enrol', {
              challengeToken: result.challengeToken,
            })
          : null;

      setChallenge({ token: result.challengeToken, audience: result.audience, enrolment });
    },
    onError: (error) => {
      // Keyed, so a third wrong password replaces the message rather than
      // stacking a third copy of it.
      toast.danger({
        key: 'sign-in',
        title: 'Could not sign you in',
        description: toDisplayMessage(error),
      });
    },
  });

  const verify = useMutation({
    mutationFn: (values: MfaValues) =>
      api.post<LoginResponse>('/v1/auth/mfa/verify', {
        challengeToken: challenge?.token ?? '',
        code: values.code,
      }),
    onSuccess: (result) => {
      if (result.status !== 'authenticated') return;
      beginSession(queryClient, result);
      setSignedIn(result.user);
    },
    onError: (error) => {
      toast.danger({
        key: 'sign-in',
        title: 'That code was not accepted',
        description: toDisplayMessage(error),
      });
    },
  });

  /**
   * The account decides which product you land in, and this is the whole
   * reason one sign-in URL is enough: an admin and an advertiser type the same
   * address and end up somewhere different.
   *
   * Taken from the login response first, and only then from the session the
   * provider holds. The provider keys its session query by the portal it reads
   * off the *URL*, and the URL is `/login` for everyone — so a driver or an
   * admin signing in here caches a session under a key nobody on this page is
   * watching, and waiting on `isAuthenticated` would wait forever.
   */
  const portal = signedIn?.audience ?? user?.portal ?? null;

  // Where they were heading when the guard sent them here, if it turns out to
  // belong to the product they signed in to.
  const from = (location.state as { from?: string } | null)?.from ?? null;
  const wantedElsewhere =
    portal && from && !isHomePortal(portal, from) ? portalLabel(portal) : null;

  useEffect(() => {
    if (!wantedElsewhere) return;
    toast.info({
      key: 'portal-mismatch',
      title: 'Taken to your dashboard instead',
      description: `The page you asked for is not part of the ${wantedElsewhere} portal.`,
    });
  }, [wantedElsewhere]);

  if (isLoading) return <FullPageSpinner label="Checking your session" />;

  if (portal) {
    return <Navigate to={from && !wantedElsewhere ? from : portalPath(portal)} replace />;
  }

  const backToCredentials = () => {
    setChallenge(null);
    mfaForm.reset({ code: '' });
    verify.reset();
    login.reset();
  };

  return (
    <AuthLayout
      icon={Car}
      wordmark="MoveAd"
      tagline="Every kilometre, accounted for."
      /*
       * Deliberately no rate here. The driver screen this design comes from
       * promises "₹1 for every verified km", which the MVP document records as
       * wrong: rates are per zone, ₹5 / ₹2 / ₹1 to the advertiser. A sign-in
       * screen is the last place to restate a number that is already contested.
       */
      pitch="Campaigns travel the city on autos and cabs. Advertisers pay for the distance we can prove, drivers earn against the same evidence, and every kilometre can be audited back to the GPS that recorded it."
      points={['Live vehicle tracking', 'Zone-by-zone billing', 'Auditable GPS trails']}
      footnote="Accounts are created by MoveAd operations. Check your invite email, or contact your account manager."
    >
      {challenge ? (
        <>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {challenge.enrolment ? 'Set up two-step verification' : 'Two-step verification'}
          </h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-slate-500">
            {challenge.enrolment
              ? 'This account can approve kilometres and release payouts, so it needs an authenticator app before the first sign-in.'
              : 'Enter the code from your authenticator app to finish signing in.'}
          </p>

          {challenge.enrolment ? (
            <EnrolAuthenticator
              secret={challenge.enrolment.secret}
              otpauthUri={challenge.enrolment.otpauthUri}
            />
          ) : null}

          <form
            noValidate
            onSubmit={(event) =>
              void mfaForm.handleSubmit((values) => verify.mutate(values))(event)
            }
            className="mt-8 space-y-4"
          >
            <TextField
              label="Verification code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              hint="The six-digit code from your authenticator app."
              className="h-12 rounded-xl text-[15px]"
              error={mfaForm.formState.errors.code?.message}
              {...mfaForm.register('code')}
            />

            <Button
              type="submit"
              className="h-12 w-full rounded-xl text-[15px]"
              loading={verify.isPending}
            >
              Verify and sign in
            </Button>

            <button
              type="button"
              onClick={backToCredentials}
              className="flex items-center gap-1.5 text-[13px] text-slate-500 transition-colors hover:text-slate-700"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Use a different account
            </button>
          </form>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in</h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-slate-500">
            One sign-in for advertisers, drivers and operations. We will take you to the right
            place.
          </p>

          <form
            noValidate
            onSubmit={(event) =>
              void credentialsForm.handleSubmit((values) => login.mutate(values))(event)
            }
            className="mt-8 space-y-4"
          >
            <TextField
              label="Email"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="priya@abcadvertising.in"
              className="h-12 rounded-xl text-[15px]"
              error={credentialsForm.formState.errors.email?.message}
              {...credentialsForm.register('email')}
            />

            <div>
              <TextField
                label="Password"
                type="password"
                autoComplete="current-password"
                className="h-12 rounded-xl text-[15px]"
                error={credentialsForm.formState.errors.password?.message}
                {...credentialsForm.register('password')}
              />
              <div className="mt-2 flex justify-end">
                <a
                  href="/forgot-password"
                  className="text-[13px] text-slate-500 transition-colors hover:text-slate-700"
                >
                  Forgot your password?
                </a>
              </div>
            </div>

            {/*
              Rejected credentials surface as a toast rather than inline. What
              is wrong is the pair, not either field, so there is no field to
              hang it under — and the toast survives the re-render that clearing
              the password box causes. Field-level messages stay under fields.
            */}
            <Button
              type="submit"
              className="h-12 w-full rounded-xl text-[15px]"
              loading={login.isPending}
            >
              Sign in
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-[13px] text-slate-400">or continue with</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          {/*
            A full page navigation, not fetch: the OAuth handshake is a browser
            redirect to the provider and back to a callback that sets the
            session cookie. Which accounts may use it is the server's decision,
            the same as for passwords.
          */}
          <a
            href="/v1/auth/oauth/google"
            className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 text-[14px] font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none"
          >
            <GoogleMark className="size-[18px]" />
            Google
          </a>
        </>
      )}
    </AuthLayout>
  );
}
