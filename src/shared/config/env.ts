/**
 * Environment configuration, validated once at startup.
 *
 * Failing loudly on boot is far better than a blank dashboard caused by an
 * undefined API URL three navigations later.
 */

import { currentWebPortal } from '@/shared/auth/portals';

function required(key: keyof ImportMetaEnv, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable ${key}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

const appEnv = import.meta.env.VITE_APP_ENV ?? 'local';

const stripTrailingSlash = (value: string) => value.replace(/\/$/, '');

/**
 * Whether *this* bundle serves canned responses.
 *
 * Per-portal rather than a plain boolean, because the two portals are not at
 * the same stage: the backend implements the admin side's drivers and
 * advertisers, and none of the advertiser side's campaigns, wallet or reports.
 * A single switch would force a choice between a real admin portal and an
 * advertiser portal that 404s on every widget.
 *
 * `VITE_USE_MOCK_API` takes `true`, `false`, or a comma-separated list of the
 * portals that should use the mock — `advertiser,driver` while those APIs are
 * still unbuilt.
 * Both bundles read the same env file, so the value has to name the portal
 * rather than assume it.
 */
export function usesMockApi(
  raw: string | undefined,
  portal: string,
  isProduction: boolean,
): boolean {
  if (isProduction) return false;

  const value = (raw ?? '').trim().toLowerCase();
  if (value === '' || value === 'false') return false;
  if (value === 'true') return true;

  return value
    .split(',')
    .map((name) => name.trim())
    .includes(portal);
}

export const env = {
  portal: __PORTAL__,
  appEnv,
  isProduction: appEnv === 'production',
  apiUrl: stripTrailingSlash(required('VITE_API_URL', import.meta.env.VITE_API_URL)),

  /*
   * No portal addresses here. All three products are served from this origin
   * and reached by path, so every link between them is relative; an absolute
   * address would only be a second, staler answer to a question the router
   * already answers. Emails are the one exception, and the server composes
   * those from its own PORTAL_* settings.
   */
  sentryDsn: import.meta.env.VITE_SENTRY_DSN,
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,

  /**
   * Mirrors the backend's `ADMIN_MFA_REQUIRED` so the mock does not demand a
   * second factor the real server has been told to skip — a mock that is
   * stricter than production is just a slower way to be wrong.
   *
   * Only the mock reads this. Against the real API the server decides, and the
   * login page simply follows the `status` it is given.
   */
  mockAdminMfa: import.meta.env.VITE_ADMIN_MFA_REQUIRED !== 'false' || appEnv === 'production',
} as const;

export type Env = typeof env;

/**
 * Whether *this request* should be mocked.
 *
 * Path-aware because the unified local app serves both portals from one
 * bundle: `/admin` talks to the real API, advertiser routes stay on fixtures
 * until campaigns and billing exist. Read on each call, not once at boot —
 * navigating from `/login` to `/admin` must change the answer.
 */
export function mockApiEnabled(): boolean {
  const portal =
    typeof window !== 'undefined' ? currentWebPortal(window.location.pathname) : 'advertiser';
  return usesMockApi(import.meta.env.VITE_USE_MOCK_API, portal, env.isProduction);
}
