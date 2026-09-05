export type Portal = 'advertiser' | 'admin' | 'driver';

/** How we name each product to a user, e.g. in a "wrong portal" message. */
const PORTAL_LABELS: Record<Portal, string> = {
  advertiser: 'advertiser',
  admin: 'operations',
  driver: 'driver',
};

export function portalLabel(portal: Portal): string {
  return PORTAL_LABELS[portal];
}

/**
 * Path prefix for the operations console when both products share one origin.
 *
 * The admin-only production bundle is served from its own host, so its routes
 * sit at `/`. The unified local app mounts that same tree at `/admin`.
 */
export const ADMIN_BASE = __PORTAL__ === 'admin' ? '' : '/admin';

/**
 * One sign-in URL for all three audiences.
 *
 * There is one credentials endpoint and the account already knows which
 * product it belongs to, so a per-portal login URL only ever asked the user a
 * question the server was about to answer anyway — and punished a wrong guess
 * with a bounce. It is `/login` in every bundle: the advertiser and admin
 * bundles are each served from their own root, and the unified app keeps the
 * page above the portal split.
 */
export const LOGIN_PATH = '/login';

/** `/drivers` → `/admin/drivers` in the unified app, `/drivers` in the admin bundle. */
export function adminPath(path: string): string {
  if (path === '/') return ADMIN_BASE || '/';
  return `${ADMIN_BASE}${path}`;
}

/** Which product a URL belongs to in the unified app. */
export function currentWebPortal(pathname: string): Portal {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin';
  if (pathname === '/driver' || pathname.startsWith('/driver/')) return 'driver';
  return 'advertiser';
}

/** Landing path after sign-in, from the account's audience. */
export function portalPath(portal: Portal): string {
  if (portal === 'admin') return adminPath('/');
  if (portal === 'driver') return '/driver';
  return '/';
}

/**
 * Whether this URL already is the portal this account belongs to.
 *
 * Used by the login page so an advertiser who signed in at `/admin/login` is
 * sent to `/`, and an admin who signed in at `/login` is sent to `/admin`.
 */
export function isHomePortal(portal: Portal, pathname: string): boolean {
  return currentWebPortal(pathname) === portal;
}
