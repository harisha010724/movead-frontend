import { describe, expect, it } from 'vitest';

import { shouldFallThroughToLive } from './client';

describe('shouldFallThroughToLive', () => {
  it('sends unknown invitation tokens to the real API', () => {
    // The mock only knows `demo` and `expired`. A 404 there is "not a fixture",
    // not "this link is invalid" — the email the customer received is real.
    expect(shouldFallThroughToLive('/v1/invitations/niHexxFX8Tot5smRDUQZ6bf3gf9UbMoXGmAmcQYqyqc', 404)).toBe(
      true,
    );
    expect(shouldFallThroughToLive('/v1/invitations/tok/accept', 404)).toBe(true);
  });

  it('leaves demo and expired invitations on the mock', () => {
    expect(shouldFallThroughToLive('/v1/invitations/demo', 200)).toBe(false);
    expect(shouldFallThroughToLive('/v1/invitations/expired', 422)).toBe(false);
  });

  it('does not pull other mocked routes through', () => {
    expect(shouldFallThroughToLive('/v1/campaigns', 404)).toBe(false);
    expect(shouldFallThroughToLive('/v1/auth/me', 401)).toBe(false);
  });
});
