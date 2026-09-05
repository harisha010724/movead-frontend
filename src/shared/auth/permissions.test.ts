import { describe, expect, it } from 'vitest';
import {
  ADMIN_PERMISSIONS as ADMIN,
  ADVERTISER_PERMISSIONS as ADVERTISER,
  hasAnyPermission,
  hasPermission,
} from './permissions';

describe('permission checks', () => {
  it('grants everything to the Super Admin wildcard', () => {
    expect(hasPermission(['*'], ADMIN.payoutRelease)).toBe(true);
    expect(hasPermission(['*'], ADMIN.campaignApprove)).toBe(true);
  });

  it('grants only what is listed for a scoped account', () => {
    const advertiser = [ADVERTISER.campaignRead, ADVERTISER.reportRead];
    expect(hasPermission(advertiser, ADVERTISER.campaignRead)).toBe(true);
    expect(hasPermission(advertiser, ADMIN.payoutRelease)).toBe(false);
  });

  it('denies everything when no permissions are granted', () => {
    expect(hasPermission([], ADVERTISER.campaignRead)).toBe(false);
    expect(hasAnyPermission([], [ADVERTISER.campaignRead, ADVERTISER.reportRead])).toBe(false);
  });

  it('matches when any of several permissions is held', () => {
    expect(
      hasAnyPermission([ADVERTISER.reportRead], [ADVERTISER.campaignRead, ADVERTISER.reportRead]),
    ).toBe(true);
  });

  /**
   * The guarantee the split exists for: no string appears in both catalogues,
   * so an advertiser's permissions cannot satisfy an admin guard even if a
   * session somehow reached the wrong portal (WEB-001, defence in depth).
   */
  it('keeps the two catalogues disjoint', () => {
    const admin = new Set<string>(Object.values(ADMIN));
    const shared = Object.values(ADVERTISER).filter((key) => admin.has(key));

    expect(shared).toEqual([]);
  });
});
