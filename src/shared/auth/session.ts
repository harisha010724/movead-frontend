import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { toCurrentUser, type AuthUserPayload } from './authContext';
import { LOGIN_PATH, type Portal } from './portals';

export type LoginResponse =
  | { status: 'authenticated'; audience: Portal; user: AuthUserPayload }
  | {
      status: 'mfa_required' | 'mfa_enrolment_required';
      audience: Portal;
      challengeToken: string;
    };

/**
 * Login and MFA already return the user. Write that into the session cache so
 * the UI does not have to call `/v1/auth/me` just to confirm a sign-in that
 * already succeeded.
 */
export function cacheSessionUser(queryClient: QueryClient, payload: AuthUserPayload): void {
  queryClient.setQueryData(queryKeys.auth.me(payload.audience), toCurrentUser(payload));
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
