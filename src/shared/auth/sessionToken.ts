import { currentWebPortal, type Portal } from './portals';

/**
 * The session token, held so it can be sent as `Authorization: Bearer`.
 *
 * The cookie is still the real mechanism and is still set on every sign-in.
 * This exists for the deployment where it cannot arrive: the portal and the
 * API are served from different sites, so a `SameSite=Strict` cookie is never
 * sent, and relaxing it to `None` only makes it a third-party cookie, which
 * Chrome blocks in Incognito today and is removing for everyone. The sign-in
 * succeeds, the cookie is stored, and every request after it is anonymous.
 *
 * The cost is the one `httpOnly` was avoiding: a token this file can read is a
 * token an XSS can read. It is not a trade worth making permanently — put the
 * portal and the API on one origin and the cookie does this job again with
 * nothing to read. The backend already prefers the cookie when both arrive, so
 * that change needs nothing here.
 *
 * Stored per audience, because the cookie is too: an operator and an
 * advertiser can be signed in to the same browser at once, and one shared slot
 * would have the second sign-in silently sign the first out.
 */

const PREFIX = 'movead.session';

const keyFor = (audience: Portal) => `${PREFIX}.${audience}`;

/**
 * Ignores anything that is not a token, rather than storing it.
 *
 * An API that predates this field returns none, and writing the absence would
 * put the string "undefined" in the header on every request afterwards — a
 * sign-in that fails in a way that reads like a rejected password. Storing
 * nothing instead leaves the cookie to do its job, which on that deployment is
 * exactly right.
 */
export function storeSessionToken(audience: Portal, token: string | undefined): void {
  if (!token) return;

  safely(() => {
    window.localStorage.setItem(keyFor(audience), token);
  });
}

/** The token for the portal this URL belongs to, or null when signed out. */
export function currentSessionToken(pathname: string): string | null {
  return (
    safely(() => window.localStorage.getItem(keyFor(currentWebPortal(pathname)))) ?? null
  );
}

export function clearSessionToken(audience: Portal): void {
  safely(() => {
    window.localStorage.removeItem(keyFor(audience));
  });
}

export function clearAllSessionTokens(): void {
  safely(() => {
    for (const audience of ['advertiser', 'admin', 'driver'] as const) {
      window.localStorage.removeItem(keyFor(audience));
    }
  });
}

/**
 * Storage throws rather than returns in two ordinary cases — Safari's private
 * mode, and a browser configured to refuse site data — and losing the token
 * should cost a sign-in, not a blank page. The cookie still covers the
 * same-origin deployment where that is most likely to be someone's setting.
 */
function safely<T>(read: () => T): T | null {
  try {
    return read();
  } catch {
    return null;
  }
}
