import { currentWebPortal, type Portal } from '@/shared/auth/portals';
import { env } from '@/shared/config/env';
import * as fx from './fixtures';

/**
 * A deliberately small stand-in for the backend, enabled with
 * VITE_USE_MOCK_API=true so the UI can be developed and reviewed before the
 * API exists. Delete this directory once the real backend is available, or
 * keep it wired to Storybook-style review builds — but never ship it enabled.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const notFound = (path: string) =>
  json({ code: 'not_found', message: `No mock handler for ${path}` }, 404);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Any password but this one signs in, so the failure state stays reviewable. */
const REJECTED_PASSWORD = 'wrong';
/** The only second factor the mock accepts. */
const VALID_MFA_CODE = '123456';
/**
 * Stands in for the session token the API returns. Nothing here checks it —
 * the mock tracks sign-in with `session` — but it is returned so the client
 * stores and sends something, and a request that only works because a header
 * was missing is caught here rather than in production.
 */
const MOCK_SESSION_TOKEN = 'mock-session-token';

/**
 * The mock holds a real session, so signing in and out behaves the way the API
 * contract says it does rather than reporting everyone as permanently signed in.
 *
 * It boots signed *out*. Landing on the dashboard without a password makes the
 * one screen every user meets first the one screen nobody ever reviews, and it
 * hides whatever the route guards do when there is no session.
 *
 * The session survives a reload, held in `sessionStorage`, because the real API
 * keeps it in a cookie and a mock that signed you out on every hot reload would
 * be a worse imitation, not a stricter one. It is per-tab and dies with the tab,
 * which is close enough to a session cookie for a stand-in.
 */
const STORAGE_KEY = 'movead.mock.session';
const DRIVER_STORAGE_KEY = 'movead.mock.driver.session';

/** Private-mode Safari throws on access rather than returning null. */
function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function restore(): boolean {
  const store = storage();
  if (!store) return false;

  // An explicit escape hatch, for when you want the signed-out state without
  // hunting for the account menu.
  if (new URLSearchParams(window.location.search).has('signedout')) {
    store.removeItem(STORAGE_KEY);
    return false;
  }

  return store.getItem(STORAGE_KEY) === 'true';
}

function restoreDriver(): boolean {
  const store = storage();
  if (!store) return false;
  return store.getItem(DRIVER_STORAGE_KEY) === 'true';
}

const session = {
  signedIn: restore(),
  awaitingSecondFactor: false,
  driverSignedIn: restoreDriver(),
  /** Who the pending second factor belongs to. */
  challengeFor: 'advertiser' as Portal,
};

function setDriverSignedIn(value: boolean): void {
  session.driverSignedIn = value;
  const store = storage();
  if (!store) return;
  if (value) store.setItem(DRIVER_STORAGE_KEY, 'true');
  else store.removeItem(DRIVER_STORAGE_KEY);
}

function setSignedIn(value: boolean): void {
  session.signedIn = value;

  const store = storage();
  if (!store) return;

  if (value) store.setItem(STORAGE_KEY, 'true');
  else store.removeItem(STORAGE_KEY);
}

/** Test seam: the session is module state and would otherwise leak across tests. */
export function resetMockSession(signedIn = false) {
  setSignedIn(signedIn);
  setDriverSignedIn(false);
  session.awaitingSecondFactor = false;
  session.challengeFor = 'advertiser';
}

/** Which product a *page* belongs to. Answers `/me` and sign-out. */
function requestPortal(): Portal {
  return typeof window !== 'undefined'
    ? currentWebPortal(window.location.pathname)
    : 'advertiser';
}

/**
 * Which product an *account* belongs to.
 *
 * Sign-in is one URL for all three audiences, so the path cannot say who is
 * signing in — only the credentials can, which is how the real API has always
 * decided it. This is the mock's stand-in for a user directory: the three
 * fixture accounts, and the bundle's own portal for anything else, so an
 * unrecognised address still signs in to the product being reviewed.
 */
function audienceForEmail(email: string): Portal {
  const address = email.trim().toLowerCase();
  if (address === fx.mockAdminUser.email) return 'admin';
  if (address === fx.mockDriverUser.email) return 'driver';
  if (address === fx.mockUser.email) return 'advertiser';
  return __PORTAL__ === 'admin' ? 'admin' : 'advertiser';
}

const userFor = (portal: Portal) => {
  if (portal === 'admin') return fx.mockAdminUser;
  if (portal === 'driver') return fx.mockDriverUser;
  return fx.mockUser;
};

const currentUser = () => userFor(requestPortal());

const unauthenticated = (message = 'Sign in to continue.') =>
  json({ code: 'unauthenticated', message }, 401);

type Handler = (body: unknown) => Response;
type ParamHandler = (id: string, body: unknown) => Response;

const handlers: Record<string, Handler> = {
  'GET /v1/auth/me': () => {
    const signedIn = requestPortal() === 'driver' ? session.driverSignedIn : session.signedIn;
    return signedIn ? json(currentUser()) : unauthenticated();
  },

  'POST /v1/auth/login': (body) => {
    const { email, password } = body as { email: string; password: string };

    // One message for a bad address and a bad password alike: saying which half
    // was wrong tells an attacker which addresses are worth guessing at.
    if (password === REJECTED_PASSWORD) {
      return unauthenticated('That email and password do not match.');
    }

    const audience = audienceForEmail(email);

    if (audience === 'driver') {
      setDriverSignedIn(true);
      return json({ status: 'authenticated', audience, user: fx.mockDriverUser, sessionToken: MOCK_SESSION_TOKEN });
    }

    // Admin TOTP is mandatory (ADM-001); an advertiser's is optional and this
    // mock account does not have one, so the password is enough. The admin
    // requirement can be switched off while the portal screens are in progress,
    // matching the backend flag of the same name.
    if (audience !== 'admin' || !env.mockAdminMfa) {
      setSignedIn(true);
      session.awaitingSecondFactor = false;
      return json({ status: 'authenticated', audience, user: userFor(audience), sessionToken: MOCK_SESSION_TOKEN });
    }

    session.awaitingSecondFactor = true;
    session.challengeFor = audience;
    setSignedIn(false);
    return json({ status: 'mfa_required', audience, challengeToken: 'chl_mock' });
  },

  'POST /v1/auth/mfa/enrol': () =>
    json({
      secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
      otpauthUri:
        'otpauth://totp/MoveAd:ops@movead.in?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=MoveAd',
    }),

  'POST /v1/auth/mfa/verify': (body) => {
    const { code } = body as { code: string };

    // The challenge only exists between a password and its second factor, so a
    // code presented outside that window is not a partial success.
    if (!session.awaitingSecondFactor) return unauthenticated();
    if (code !== VALID_MFA_CODE) {
      return unauthenticated('That code is not valid or has expired.');
    }

    session.awaitingSecondFactor = false;
    setSignedIn(true);

    // The account that presented the password, not the page the code was typed
    // on — the second factor cannot change who is signing in.
    const audience = session.challengeFor;
    return json({ status: 'authenticated', audience, user: userFor(audience), sessionToken: MOCK_SESSION_TOKEN });
  },

  'POST /v1/auth/logout': () => {
    if (requestPortal() === 'driver') setDriverSignedIn(false);
    else resetMockSession();
    return new Response(null, { status: 204 });
  },

  'GET /v1/driver/me': () =>
    session.driverSignedIn ? json(fx.mockDriverProfile) : unauthenticated(),

  'GET /v1/driver/earnings': () =>
    session.driverSignedIn ? json(fx.mockDriverEarnings) : unauthenticated(),

  'GET /v1/driver/campaign': () =>
    session.driverSignedIn ? json(fx.mockDriverCampaign) : unauthenticated(),

  'GET /v1/driver/eligibility': () =>
    session.driverSignedIn ? json(fx.mockDriverEligibility) : unauthenticated(),

  'GET /v1/campaigns': () =>
    json({ items: fx.mockCampaigns, page: 1, pageSize: 20, total: fx.mockCampaigns.length }),

  'POST /v1/campaigns/estimate': (body) => {
    const input = body as {
      zonePrimeKm?: string;
      zoneSecondaryKm?: string;
      startDate: string;
      endDate: string;
    };
    const primeKm = Number(input.zonePrimeKm || 0);
    const secondaryKm = Number(input.zoneSecondaryKm || 0);
    const prime = primeKm * 5;
    const secondary = secondaryKm * 2;
    const total = prime + secondary;
    const days =
      (Date.parse(`${input.endDate}T00:00:00Z`) - Date.parse(`${input.startDate}T00:00:00Z`)) /
        86_400_000 +
      1;
    const totalKm = primeKm + secondaryKm;
    return json({
      budget: total.toFixed(2),
      estimatedKm: { prime: primeKm, secondary: secondaryKm, network: 0 },
      estimatedSpend: {
        prime: prime.toFixed(2),
        secondary: secondary.toFixed(2),
        network: '0.00',
        total: total.toFixed(2),
      },
      estimatedVehicles: Math.max(1, Math.ceil(totalKm / (days * 80))),
      estimatedDays: days,
    });
  },

  'GET /v1/dashboard/advertiser': () => json(fx.mockAdvertiserDashboard),
  'GET /v1/dashboard/admin': () => json(fx.mockAdminDashboard),

  'GET /v1/vehicles': () =>
    json({ items: fx.mockVehicles, page: 1, pageSize: 20, total: fx.mockVehicles.length }),
  'GET /v1/vehicles/live-positions': () =>
    json({ items: fx.mockLivePositions, updatedAt: new Date().toISOString() }),

  'GET /v1/admin/drivers': () =>
    json({ items: fx.mockDrivers, page: 1, pageSize: 20, total: fx.mockDrivers.length }),

  'POST /v1/campaigns/available-vehicles': (body) => json(fx.vehiclesInZones(body, false)),
  'POST /v1/admin/vehicles/in-zones': (body) => json(fx.vehiclesInZones(body, true)),

  'POST /v1/admin/drivers': (body) => {
    const input = body as {
      name: string;
      mobile: string;
      location?: { city?: string; label: string; lat: number; lng: number };
      vehicle?: { registrationNumber: string; category: 'AUTO' | 'CAB' } | null;
    };

    if (fx.hasMockMobile(input.mobile)) {
      return json(
        {
          code: 'conflict',
          message: 'A driver with that mobile number already exists.',
          details: { fields: ['mobile'] },
        },
        409,
      );
    }

    // AC-05.7: a duplicate registration number is rejected.
    if (input.vehicle && fx.hasMockRegistration(input.vehicle.registrationNumber)) {
      return json(
        {
          code: 'conflict',
          message: 'A vehicle with this registration number already exists.',
          details: { fields: ['registration_number'] },
        },
        409,
      );
    }

    return json(fx.addMockDriver(input), 201);
  },

  'GET /v1/billing/wallet': () => json(fx.mockWallet),

  'GET /v1/advertisers': () =>
    json({
      items: fx.mockAdvertisers,
      page: 1,
      pageSize: 20,
      total: fx.mockAdvertisers.length,
    }),

  // A bare array, not a page: the operations list is capped server-side rather
  // than paged, and the mock matches the contract instead of improving on it.
  'GET /v1/admin/advertisers': () => json(fx.mockAdminAdvertisers),

  'POST /v1/admin/advertisers': (body) => {
    const input = body as {
      legalName: string;
      brandName: string;
      gstin?: string | null;
      pan?: string | null;
      billingEmail: string;
      user?: { email: string; fullName: string } | null;
    };

    // The contact's email is a login, so it is unique platform-wide. The
    // billing address is not an account and does not clash with anything.
    if (input.user && fx.hasMockAdvertiserEmail(input.user.email)) {
      return json(
        {
          code: 'conflict',
          message: 'That email address is already registered.',
          details: { fields: ['email'] },
        },
        409,
      );
    }

    const { advertiser } = fx.addMockAdvertiser(input);
    return json(
      {
        advertiser,
        user: advertiser.primaryUser,
        invitationEmailed: advertiser.primaryUser !== null,
      },
      201,
    );
  },

  'POST /v1/campaigns': (body) => {
    const input = body as {
      advertiserId?: string;
      budget?: string;
      zonePrimeKm?: string;
      zoneSecondaryKm?: string;
    };
    const budget = (
      Number(input.zonePrimeKm || 0) * 5 + Number(input.zoneSecondaryKm || 0) * 2 ||
      Number(input.budget || 0)
    ).toFixed(2);

    // AC-34.6: admin cannot commit budget the advertiser has not funded. The
    // browser checks this too, but only the server's answer counts.
    if (input.advertiserId) {
      const advertiser = fx.mockAdvertisers.find((a) => a.id === input.advertiserId);
      if (!advertiser) {
        return json({ code: 'not_found', message: 'Unknown advertiser.' }, 404);
      }
      if (compare(budget, advertiser.wallet.available) > 0) {
        return json(
          {
            code: 'insufficient_wallet_balance',
            message: 'The budget exceeds this advertiser’s available wallet balance.',
          },
          422,
        );
      }
    }

    // AC-34.7: created in review, following the same approval path as any
    // other campaign, and not approved by whoever created it.
    return json({ id: `cmp_${Date.now()}`, status: 'PENDING_APPROVAL' }, 201);
  },
};

/**
 * Routes with an id in the path, which the exact-match table above cannot
 * express. `*` stands for the one segment that varies and is passed to the
 * handler, and an action may follow it — see the accept route below.
 */
const paramHandlers: Record<string, ParamHandler> = {
  'PATCH /v1/admin/drivers/*': (id, body) => {
    const changes = body as {
      name?: string;
      mobile?: string;
      location?: { city?: string; label: string; lat: number; lng: number };
    };
    const driver = fx.mockDrivers.find((d) => d.id === id);
    if (!driver) return json({ code: 'not_found', message: 'No such driver.' }, 404);

    if (changes.mobile !== undefined && changes.mobile !== driver.mobile) {
      if (driver.status !== 'PENDING') {
        return json(
          {
            code: 'mobile_locked',
            message:
              'The mobile number can only be corrected while the driver is still pending.',
          },
          422,
        );
      }
      if (fx.hasMockMobile(changes.mobile)) {
        return json(
          {
            code: 'conflict',
            message: 'A driver with that mobile number already exists.',
            details: { fields: ['mobile'] },
          },
          409,
        );
      }
      driver.mobile = changes.mobile;
    }

    if (changes.name !== undefined) driver.name = changes.name;
    if (changes.location) {
      driver.city = changes.location.city ?? 'Bengaluru';
      driver.location = {
        city: changes.location.city ?? 'Bengaluru',
        label: changes.location.label,
        lat: changes.location.lat,
        lng: changes.location.lng,
      };
    }
    return json(driver);
  },

  'PATCH /v1/admin/vehicles/*': (id, body) => {
    const changes = body as { registrationNumber?: string; category?: 'AUTO' | 'CAB' };
    const driver = fx.mockDrivers.find((d) => d.vehicle?.id === id);
    const vehicle = driver?.vehicle;
    if (!vehicle) return json({ code: 'not_found', message: 'No such vehicle.' }, 404);

    if (vehicle.status !== 'PENDING') {
      return json(
        {
          code: 'vehicle_not_editable',
          message: `A vehicle can only be corrected while PENDING; this one is ${vehicle.status}.`,
        },
        422,
      );
    }

    if (
      changes.registrationNumber !== undefined &&
      changes.registrationNumber !== vehicle.registrationNumber &&
      fx.hasMockRegistration(changes.registrationNumber)
    ) {
      return json(
        {
          code: 'conflict',
          message: 'A vehicle with this registration number already exists.',
          details: { fields: ['registration_number'] },
        },
        409,
      );
    }

    if (changes.registrationNumber !== undefined) {
      vehicle.registrationNumber = changes.registrationNumber;
    }
    if (changes.category !== undefined) vehicle.category = changes.category;
    return json(vehicle);
  },

  'PATCH /v1/admin/advertisers/*': (id, body) => {
    const changes = body as {
      legalName?: string;
      brandName?: string;
      gstin?: string | null;
      pan?: string | null;
      billingEmail?: string;
    };

    const advertiser = fx.mockAdminAdvertisers.find((a) => a.id === id);
    if (!advertiser) return json({ code: 'not_found', message: 'No such advertiser.' }, 404);

    if (changes.legalName !== undefined) advertiser.legalName = changes.legalName;
    if (changes.brandName !== undefined) advertiser.brandName = changes.brandName;
    if (changes.billingEmail !== undefined) advertiser.billingEmail = changes.billingEmail;
    // `in` rather than a truthiness test: null means clear the field, and the
    // real API draws the same distinction.
    if ('gstin' in changes) advertiser.gstin = changes.gstin ?? null;
    if ('pan' in changes) advertiser.pan = changes.pan ?? null;

    return json(advertiser);
  },

  'PATCH /v1/admin/users/*': (id, body) => {
    const changes = body as { fullName?: string; email?: string };

    if (changes.email !== undefined && fx.hasMockAdvertiserEmail(changes.email)) {
      const current = fx.mockAdminAdvertisers.find((a) => a.primaryUser?.id === id);
      if (current?.primaryUser?.email !== changes.email) {
        return json(
          {
            code: 'conflict',
            message: 'That email address is already registered.',
            details: { fields: ['email'] },
          },
          409,
        );
      }
    }

    const updated = fx.updateMockUser(id, changes);
    if (!updated) return json({ code: 'not_found', message: 'No such user.' }, 404);

    const moved = updated.emailChange.previousEmail !== updated.user.email;
    return json({
      ...updated.user,
      // Null when the address was not touched, exactly as the API reports it.
      emailChange: moved ? updated.emailChange : null,
    });
  },

  'GET /v1/admin/drivers/*': (id) => {
    const detail = fx.mockDriverDetail(id);
    return detail ? json(detail) : json({ code: 'not_found', message: 'No such driver.' }, 404);
  },

  'POST /v1/admin/documents/*/verify': (id) => {
    const item = fx.decideMockDocument(id, 'verified', null);
    return item ? json(item) : json({ code: 'not_found', message: 'No such document.' }, 404);
  },

  'POST /v1/admin/documents/*/reject': (id, body) => {
    const { reason } = (body ?? {}) as { reason?: string };
    if (!reason || reason.trim().length < 10) {
      return json({ code: 'validation_failed', message: 'A reason is required.' }, 400);
    }

    const item = fx.decideMockDocument(id, 'rejected', reason);
    return item ? json(item) : json({ code: 'not_found', message: 'No such document.' }, 404);
  },

  /*
   * The API refuses this while anything mandatory is unverified, and so does
   * the mock — the review screen's disabled button is a courtesy, not the rule.
   */
  'POST /v1/admin/drivers/*/approve': (id) => {
    const detail = fx.mockDriverDetail(id);
    if (!detail) return json({ code: 'not_found', message: 'No such driver.' }, 404);

    const outstanding = detail.driverDocuments.filter(
      (item) => item.isMandatory && item.status !== 'verified',
    );
    if (outstanding.length > 0) {
      return json(
        {
          code: 'documents_outstanding',
          message: 'Verify the driver’s documents before approving them.',
          details: { outstanding: outstanding.map((item) => ({ kind: item.kind })) },
        },
        422,
      );
    }

    return json(fx.setMockDriverStatus(id, 'APPROVED'));
  },

  'POST /v1/admin/drivers/*/reject': (id, body) => {
    const { reason } = (body ?? {}) as { reason?: string };
    if (!reason || reason.trim().length < 10) {
      return json({ code: 'validation_failed', message: 'A reason is required.' }, 400);
    }

    const driver = fx.setMockDriverStatus(id, 'PENDING');
    return driver ? json(driver) : json({ code: 'not_found', message: 'No such driver.' }, 404);
  },

  'DELETE /v1/admin/drivers/*': (id, body) => {
    const { reason } = (body ?? {}) as { reason?: string };
    if (!reason || reason.length < 10) {
      return json({ code: 'validation_failed', message: 'A reason is required.' }, 400);
    }

    const removed = fx.removeMockDriver(id, reason);
    return removed
      ? json(removed)
      : json({ code: 'not_found', message: 'No such driver.' }, 404);
  },

  /*
   * Reading an invitation. Unauthenticated on the real API too — whoever is
   * here has no password yet, which is the entire reason the endpoint exists.
   *
   * Each refusal carries its own code because the page says something different
   * for each: ask for another, you already did this, check for a newer email.
   */
  'GET /v1/invitations/*': (token) => {
    const invitation = fx.mockInvitations.get(token);
    if (!invitation) {
      return json({ code: 'not_found', message: 'That invitation link is not valid.' }, 404);
    }

    if (invitation.acceptedAt) {
      return json(
        {
          code: 'invitation_used',
          message: 'This invitation has already been used. Sign in with your password instead.',
        },
        422,
      );
    }

    if (invitation.supersededAt) {
      return json(
        {
          code: 'invitation_superseded',
          message: 'A newer invitation was sent to you. Please use the most recent email.',
        },
        422,
      );
    }

    if (new Date(invitation.expiresAt) <= new Date()) {
      return json(
        {
          code: 'invitation_expired',
          message: 'This invitation has expired. Ask your MoveAd contact to send another.',
        },
        422,
      );
    }

    return json({
      email: invitation.email,
      fullName: invitation.fullName,
      organisation: invitation.organisation,
      expiresAt: invitation.expiresAt,
    });
  },

  'POST /v1/invitations/*/accept': (token, body) => {
    const { password } = (body ?? {}) as { password?: string };
    if (!password || password.length < 12) {
      return json({ code: 'validation_failed', message: 'Use at least 12 characters.' }, 400);
    }

    const invitation = fx.mockInvitations.get(token);
    if (!invitation) {
      return json({ code: 'not_found', message: 'That invitation link is not valid.' }, 404);
    }
    if (invitation.acceptedAt) {
      return json(
        { code: 'invitation_used', message: 'This invitation has already been used.' },
        422,
      );
    }

    fx.acceptMockInvitation(token);
    return json({ email: invitation.email, audience: 'advertiser' });
  },

  'POST /v1/admin/users/*/resend-invitation': (userId) => {
    const advertiser = fx.resendMockInvitation(userId);
    if (!advertiser?.primaryUser) {
      return json({ code: 'not_found', message: 'No such user.' }, 404);
    }

    return json({
      email: advertiser.primaryUser.email,
      delivered: true,
      expiresAt: advertiser.primaryUser.invitationExpiresAt,
    });
  },
};

/**
 * Matches a path against the wildcard keys above, returning the segment `*`
 * stood for. Segment-by-segment rather than a regex, so a token containing an
 * unexpected character cannot change which route it reaches.
 */
function matchParamHandler(
  method: string,
  pathname: string,
): { handler: ParamHandler; id: string } | null {
  const parts = pathname.split('/');

  for (const [key, handler] of Object.entries(paramHandlers)) {
    const [keyMethod, keyPath] = key.split(' ');
    if (keyMethod !== method || !keyPath) continue;

    const pattern = keyPath.split('/');
    if (pattern.length !== parts.length) continue;

    let id: string | null = null;
    const matched = pattern.every((segment, index) => {
      const part = parts[index] ?? '';
      if (segment !== '*') return segment === part;
      id = part;
      return part.length > 0;
    });

    if (matched && id) return { handler, id };
  }

  return null;
}

/** Exact decimal comparison, mirroring the server's NUMERIC semantics. */
function compare(a: string, b: string): number {
  const scale = (value: string) => {
    const [whole = '0', fraction = ''] = value.split('.');
    return BigInt(whole + fraction.padEnd(4, '0').slice(0, 4));
  };
  const left = scale(a);
  const right = scale(b);
  if (left < right) return -1;
  return left > right ? 1 : 0;
}

export async function mockFetch(
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  // A little latency makes loading and skeleton states visible during review.
  await delay(220 + Math.random() * 260);

  const pathname = path.split('?')[0] ?? path;
  const handler = handlers[`${method} ${pathname}`];
  if (handler) return handler(body);

  const parameterised = matchParamHandler(method, pathname);
  if (parameterised) return parameterised.handler(parameterised.id, body);

  return notFound(`${method} ${pathname}`);
}
