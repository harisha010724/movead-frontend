import { beforeEach, describe, expect, it } from 'vitest';

import { mockAdminAdvertisers, mockInvitations } from './fixtures';
import { mockFetch } from './mockFetch';

/**
 * Onboarding an advertiser, against the mock.
 *
 * These assert the contract the dialogs are written against, not the server's
 * behaviour. Their value is that a mock which quietly drifts from the real
 * shape produces screens that work in review and break the moment the flag is
 * turned off — which is the failure the mock exists to prevent.
 */

const NEW_ADVERTISER = {
  legalName: 'Zephyr Beverages Private Limited',
  brandName: 'Zephyr',
  billingEmail: 'accounts@zephyr.example',
  gstin: null,
  pan: null,
  user: { email: 'priya@zephyr.example', fullName: 'Priya Menon' },
};

describe('POST /v1/admin/advertisers', () => {
  let advertisers: typeof mockAdminAdvertisers;
  let invitations: [string, ReturnType<typeof mockInvitations.get>][];

  beforeEach(() => {
    advertisers = mockAdminAdvertisers.map((a) => ({ ...a }));
    invitations = [...mockInvitations.entries()];

    return () => {
      mockAdminAdvertisers.length = 0;
      mockAdminAdvertisers.push(...advertisers);
      mockInvitations.clear();
      for (const [token, invitation] of invitations) {
        if (invitation) mockInvitations.set(token, invitation);
      }
    };
  });

  it('creates the organisation and its first user in one call', async () => {
    const response = await mockFetch('POST', '/v1/admin/advertisers', NEW_ADVERTISER);
    expect(response.status).toBe(201);

    const body = (await response.json()) as {
      advertiser: { brandName: string; status: string };
      user: { email: string; status: string } | null;
      invitationEmailed: boolean;
    };

    // Not ACTIVE on creation: that waits on a funded wallet.
    expect(body.advertiser.status).toBe('ONBOARDING');
    expect(body.user?.email).toBe('priya@zephyr.example');
    // INVITED, because no password has been chosen yet.
    expect(body.user?.status).toBe('INVITED');
    expect(body.invitationEmailed).toBe(true);
  });

  it('rejects a contact email that is already a login', async () => {
    const taken = mockAdminAdvertisers.find((a) => a.primaryUser)?.primaryUser?.email ?? '';

    const response = await mockFetch('POST', '/v1/admin/advertisers', {
      ...NEW_ADVERTISER,
      user: { email: taken, fullName: 'Someone Else' },
    });

    expect(response.status).toBe(409);
    // Named, so the dialog puts it under the input that caused it.
    const body = (await response.json()) as { details: { fields: string[] } };
    expect(body.details.fields).toContain('email');
  });

  it('opens an account with no contact at all', async () => {
    const response = await mockFetch('POST', '/v1/admin/advertisers', {
      ...NEW_ADVERTISER,
      user: null,
    });

    const body = (await response.json()) as { user: unknown; invitationEmailed: boolean };
    expect(body.user).toBeNull();
    // Nothing to send, so nothing was sent.
    expect(body.invitationEmailed).toBe(false);
  });

  it('returns a bare array from the list, matching the real contract', async () => {
    const response = await mockFetch('GET', '/v1/admin/advertisers');
    const body = await response.json();

    expect(Array.isArray(body)).toBe(true);
  });
});

describe('PATCH /v1/admin/advertisers/{id}', () => {
  let advertisers: typeof mockAdminAdvertisers;

  beforeEach(() => {
    advertisers = structuredClone(mockAdminAdvertisers);
    return () => {
      mockAdminAdvertisers.length = 0;
      mockAdminAdvertisers.push(...advertisers);
    };
  });

  const firstId = () => mockAdminAdvertisers[0]?.id ?? '';

  it('changes only the fields it is given', async () => {
    const before = { ...mockAdminAdvertisers[0]! };

    const response = await mockFetch('PATCH', `/v1/admin/advertisers/${firstId()}`, {
      brandName: 'Renamed',
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { brandName: string; legalName: string };
    expect(body.brandName).toBe('Renamed');
    expect(body.legalName).toBe(before.legalName);
  });

  it('clears a tax identifier when sent null, and leaves it when absent', async () => {
    await mockFetch('PATCH', `/v1/admin/advertisers/${firstId()}`, { gstin: '29ABCDE1234F1Z5' });

    const cleared = await mockFetch('PATCH', `/v1/admin/advertisers/${firstId()}`, {
      gstin: null,
    });

    const body = (await cleared.json()) as { gstin: string | null; pan: string | null };
    expect(body.gstin).toBeNull();
    expect(body.pan).toBe(mockAdminAdvertisers[0]?.pan ?? null);
  });

  it('leaves the primary user alone, since the contact is not editable here', async () => {
    const contact = mockAdminAdvertisers[0]?.primaryUser;

    const response = await mockFetch('PATCH', `/v1/admin/advertisers/${firstId()}`, {
      legalName: 'A Corrected Legal Name Private Limited',
    });

    const body = (await response.json()) as { primaryUser: { email: string } | null };
    expect(body.primaryUser?.email).toBe(contact?.email);
  });

  it('refuses an advertiser that does not exist', async () => {
    const response = await mockFetch('PATCH', '/v1/admin/advertisers/adv_nope', {
      brandName: 'Nobody',
    });
    expect(response.status).toBe(404);
  });
});

describe('PATCH /v1/admin/users/{id}', () => {
  let advertisers: typeof mockAdminAdvertisers;
  let invitations: [string, ReturnType<typeof mockInvitations.get>][];

  beforeEach(() => {
    advertisers = structuredClone(mockAdminAdvertisers);
    invitations = structuredClone([...mockInvitations.entries()]);

    return () => {
      mockAdminAdvertisers.length = 0;
      mockAdminAdvertisers.push(...advertisers);
      mockInvitations.clear();
      for (const [token, invitation] of invitations) {
        if (invitation) mockInvitations.set(token, invitation);
      }
    };
  });

  const invitedUser = () =>
    mockAdminAdvertisers.find((a) => a.primaryUser?.status === 'INVITED')?.primaryUser;
  const activeUser = () =>
    mockAdminAdvertisers.find((a) => a.primaryUser?.status === 'ACTIVE')?.primaryUser;

  it('renames a contact without reporting an address change', async () => {
    const user = invitedUser();

    const response = await mockFetch('PATCH', `/v1/admin/users/${user?.id ?? ''}`, {
      fullName: 'Corrected Name',
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { fullName: string; emailChange: unknown };
    expect(body.fullName).toBe('Corrected Name');
    // Nothing about their credential moved, so there is nothing to warn about.
    expect(body.emailChange).toBeNull();
  });

  it('reissues the invitation when an invited contact is corrected', async () => {
    const user = invitedUser();
    const previous = user?.email;

    const response = await mockFetch('PATCH', `/v1/admin/users/${user?.id ?? ''}`, {
      email: 'corrected@zephyr.example',
    });

    const body = (await response.json()) as {
      email: string;
      emailChange: { previousEmail: string; invitationResent: boolean };
    };

    expect(body.email).toBe('corrected@zephyr.example');
    expect(body.emailChange.invitationResent).toBe(true);
    expect(body.emailChange.previousEmail).toBe(previous);
  });

  it('does not reissue anything for a contact who already signed in', async () => {
    // Read off before the call: the fixture row is mutated in place.
    const { id = '', email } = activeUser() ?? {};

    const response = await mockFetch('PATCH', `/v1/admin/users/${id}`, {
      email: 'moved@zephyr.example',
    });

    const body = (await response.json()) as {
      emailChange: { invitationResent: boolean; previousEmail: string };
    };

    // They have a password. What they get is a warning to the old address.
    expect(body.emailChange.invitationResent).toBe(false);
    expect(body.emailChange.previousEmail).toBe(email);
  });

  it('refuses an address another account already holds', async () => {
    const taken = activeUser()?.email ?? '';

    const response = await mockFetch('PATCH', `/v1/admin/users/${invitedUser()?.id ?? ''}`, {
      email: taken,
    });

    expect(response.status).toBe(409);
    const body = (await response.json()) as { details: { fields: string[] } };
    expect(body.details.fields).toContain('email');
  });

  it('refuses a user that does not exist', async () => {
    const response = await mockFetch('PATCH', '/v1/admin/users/usr_nope', {
      fullName: 'Nobody At All',
    });
    expect(response.status).toBe(404);
  });
});

describe('invitations', () => {
  let invitations: [string, ReturnType<typeof mockInvitations.get>][];

  beforeEach(() => {
    invitations = structuredClone([...mockInvitations.entries()]);
    return () => {
      mockInvitations.clear();
      for (const [token, invitation] of invitations) {
        if (invitation) mockInvitations.set(token, invitation);
      }
    };
  });

  it('describes a live invitation without any session', async () => {
    const response = await mockFetch('GET', '/v1/invitations/demo');
    expect(response.status).toBe(200);

    const body = (await response.json()) as { email: string; organisation: string };
    expect(body.email).toBe('rohan@swiggy.example');
    expect(body.organisation).toBe('Swiggy');
  });

  it('refuses an unknown token', async () => {
    const response = await mockFetch('GET', '/v1/invitations/nonsense');
    expect(response.status).toBe(404);
  });

  it('gives expiry its own code, so the page can offer the right way out', async () => {
    const response = await mockFetch('GET', '/v1/invitations/expired');

    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('invitation_expired');
  });

  it('sets the password and reports which portal to sign in to', async () => {
    const response = await mockFetch('POST', '/v1/invitations/demo/accept', {
      password: 'a-password-they-chose',
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { audience: string };
    expect(body.audience).toBe('advertiser');
  });

  it('works exactly once', async () => {
    await mockFetch('POST', '/v1/invitations/demo/accept', {
      password: 'a-password-they-chose',
    });

    const again = await mockFetch('POST', '/v1/invitations/demo/accept', {
      password: 'a-different-password',
    });

    expect(again.status).toBe(422);
    const body = (await again.json()) as { code: string };
    expect(body.code).toBe('invitation_used');
  });

  it('refuses a password under twelve characters', async () => {
    const response = await mockFetch('POST', '/v1/invitations/demo/accept', {
      password: 'short',
    });
    expect(response.status).toBe(400);
  });
});

describe('POST /v1/admin/users/{id}/resend-invitation', () => {
  it('issues a fresh link for the contact', async () => {
    const user = mockAdminAdvertisers.find(
      (a) => a.primaryUser?.status === 'INVITED',
    )?.primaryUser;

    const response = await mockFetch(
      'POST',
      `/v1/admin/users/${user?.id ?? ''}/resend-invitation`,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { email: string; delivered: boolean };
    expect(body.email).toBe(user?.email);
    expect(body.delivered).toBe(true);
  });

  it('refuses a user that does not exist', async () => {
    const response = await mockFetch('POST', '/v1/admin/users/usr_nope/resend-invitation');
    expect(response.status).toBe(404);
  });
});
