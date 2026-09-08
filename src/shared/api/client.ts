import { currentWebPortal } from '@/shared/auth/portals';
import { currentSessionToken } from '@/shared/auth/sessionToken';
import { env, mockApiEnabled } from '@/shared/config/env';
import { ApiError, NetworkError } from './errors';
import { mockFetch } from './mock/mockFetch';

type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
  /** Required on any non-idempotent money operation: top-ups, payout release. */
  idempotencyKey?: string;
}

function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${env.apiUrl}${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

/**
 * Invitation links in real emails carry tokens the mock has never seen.
 *
 * The advertiser portal stays mocked for campaigns and billing, but a 404 from
 * the fixture set is not "this link is invalid" — it is "this is not a demo
 * token". Those we send on to the real API. `/invitation/demo` and
 * `/invitation/expired` stay on the mock, so the page can still be reviewed
 * without a backend.
 */
export function shouldFallThroughToLive(path: string, status: number): boolean {
  return path.startsWith('/v1/invitations/') && status === 404;
}

/** Auth, invitations, campaigns and the inbox talk to the real API even when the rest of the advertiser portal is mocked. Driver auth and /v1/driver/* are live. */
function isLiveApiPath(path: string): boolean {
  if (typeof window !== 'undefined' && currentWebPortal(window.location.pathname) === 'driver') {
    return (
      path.startsWith('/v1/auth/') ||
      path.startsWith('/v1/invitations/') ||
      path.startsWith('/v1/driver/')
    );
  }
  return (
    path.startsWith('/v1/auth/') ||
    path.startsWith('/v1/invitations/') ||
    path.startsWith('/v1/campaigns') ||
    path.startsWith('/v1/notifications') ||
    path.startsWith('/v1/vehicles/available')
  );
}

async function parseError(response: Response): Promise<ApiError> {
  let code = 'unknown_error';
  let message = response.statusText || 'Request failed';
  let details: unknown;

  try {
    const body = (await response.json()) as {
      code?: string;
      message?: string;
      details?: unknown;
    };
    code = body.code ?? code;
    message = body.message ?? message;
    details = body.details;
  } catch {
    // Non-JSON error body; the status alone will have to do.
  }

  return new ApiError({
    status: response.status,
    code,
    message,
    details,
    requestId: response.headers.get('x-request-id') ?? undefined,
  });
}

/**
 * The session cookie first, and the token only where the cookie cannot go.
 *
 * `credentials: 'include'` still sends the cookie, and the API still prefers
 * it, so a same-origin deployment authenticates exactly as before and the
 * header is never needed. It is sent anyway because whether the cookie will
 * arrive is not knowable from here: the browser decides that, silently, from
 * how the two hosts relate. Sending both means the request works either way.
 */
function authHeaders(): Record<string, string> {
  const token = currentSessionToken(window.location.pathname);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...authHeaders() };

  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  const init: RequestInit = {
    method,
    headers,
    credentials: 'include',
    signal: options.signal,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  };

  const url = buildUrl(path, options.query);

  let response: Response;
  try {
    if (mockApiEnabled() && !isLiveApiPath(path)) {
      response = await mockFetch(method, path, options.body);
      if (shouldFallThroughToLive(path, response.status)) {
        response = await fetch(url, init);
      }
    } else {
      response = await fetch(url, init);
    }
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new NetworkError(cause);
  }

  if (response.status === 204) return undefined as T;
  if (!response.ok) throw await parseError(response);

  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PUT', path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
  /**
   * Multipart upload. The browser sets the boundary; do not set Content-Type
   * yourself or the server cannot parse the parts.
   */
  upload: <T>(path: string, form: FormData, options?: Omit<RequestOptions, 'body'>) =>
    uploadForm<T>(path, form, options),
};

async function uploadForm<T>(
  path: string,
  form: FormData,
  options: Omit<RequestOptions, 'body'> = {},
): Promise<T> {
  const init: RequestInit = {
    method: 'POST',
    // No Content-Type: the browser sets it with the multipart boundary.
    headers: { Accept: 'application/json', ...authHeaders() },
    credentials: 'include',
    body: form,
    signal: options.signal,
  };

  const url = buildUrl(path, options.query);
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new NetworkError(cause);
  }

  if (response.status === 204) return undefined as T;
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as T;
}
