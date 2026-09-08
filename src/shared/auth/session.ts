import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { toCurrentUser, type AuthUserPayload } from './authContext';
import { LOGIN_PATH, type Portal } from './portals';
import { storeSessionToken } from './sessionToken';

export interface AuthenticatedResponse {
  status: 'authenticated';
  audience: Portal;
  user: AuthUserPayload;
  sessionToken: string;
}

export type LoginResponse =
  | AuthenticatedResponse
  | {
      status: 'mfa_required' | 'mfa_enrolment_required';
      audience: Portal;
      challengeToken: string;
    };

/**
 * Everything a successful sign-in has to record, in one call.
 *
 * Both doors lead here — password alone, and password then authenticator — and
 * so does accepting an invitation. Keeping the token and the cached user
 * together is why: a sign-in that cached the user but dropped the token looks
 * signed in until the first request, which is the failure this whole path
 * exists to stop happening.
 *
 * The user comes back from login and MFA already, so writing it here saves a
 * `/v1/auth/me` round trip to confirm a sign-in that just succeeded.
 */
export function beginSession(queryClient: QueryClient, result: AuthenticatedResponse): void {
  storeSessionToken(result.user.audience, result.sessionToken);
  queryClient.setQueryData(queryKeys.auth.me(result.user.audience), toCurrentUser(result.user));
}

/**
 * Sign-in and invitation pages: no session to restore, so no `/me` probe.
 *
 * The two retired login URLs stay on the list. They now render nothing but a
 * redirect to `/login`, and probing for a session on the way past would only
 * put a spinner in front of a page that is already leaving.
 */
export function isPublicAuthPath(pathname: string): boolean {
  return (
    pathname === LOGIN_PATH ||
    pathname === '/admin/login' ||
    pathname === '/driver/login' ||
    pathname.startsWith('/invitation/') ||
    pathname.startsWith('/driver/invitation/')
  );
}
