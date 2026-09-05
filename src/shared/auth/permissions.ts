/**
 * Named permissions, checked individually.
 *
 * ADM-028: authorisation is a permission check, not a role-name check, even
 * though every permission currently resolves to granted for Super Admin.
 * Adding a role later means configuring a permission set, not editing guards.
 *
 * The keys mirror the server's catalogue exactly, because a key that only
 * exists here is a permission nobody can ever hold — the check would silently
 * fail closed and the feature would simply never appear.
 *
 * The two sets are disjoint by design. No string is shared between them, so an
 * advertiser's permissions can never satisfy an admin guard even before the
 * session's audience is checked (WEB-001).
 *
 * The client-side check only decides what to render. The server enforces the
 * same permission on every request, and unrendered actions are still rejected
 * if called directly.
 */

/** Advertiser portal. Scope — whose campaigns — is enforced server-side. */
export const ADVERTISER_PERMISSIONS = {
  campaignCreate: 'advertiser.campaign.create',
  campaignRead: 'advertiser.campaign.read',
  campaignConfirm: 'advertiser.campaign.confirm',
  vehicleSelect: 'advertiser.vehicle.select',
  vehicleRead: 'advertiser.vehicle.read',
  trackingRead: 'advertiser.tracking.read',
  reportRead: 'advertiser.report.read',
  walletRead: 'advertiser.wallet.read',
  walletTopUp: 'advertiser.wallet.topup',
  orderPlace: 'advertiser.order.place',
  pricingConfigure: 'advertiser.pricing.configure',
  userRead: 'advertiser.user.read',
} as const;

/** Admin portal. */
export const ADMIN_PERMISSIONS = {
  driverCreate: 'driver.create',
  driverRead: 'driver.read',
  driverApprove: 'driver.approve',
  driverSuspend: 'driver.suspend',
  /** Removing from the platform, which suspending is not. */
  driverDelete: 'driver.delete',

  vehicleRead: 'vehicle.read',
  vehicleApprove: 'vehicle.approve',
  vehicleSuspend: 'vehicle.suspend',

  documentRead: 'document.read',
  documentVerify: 'document.verify',

  advertiserCreate: 'advertiser.create',
  advertiserRead: 'advertiser.read',
  advertiserActivate: 'advertiser.activate',

  campaignCreate: 'campaign.create',
  campaignRead: 'campaign.read',
  campaignApprove: 'campaign.approve',
  campaignAssign: 'campaign.assign',

  installationReview: 'installation.review',
  installationApprove: 'installation.approve',

  /** Flagged kilometres awaiting a decision. */
  segmentReview: 'segment.review',
  /** Replaying a trip on a map — the GPS audit view. */
  tripAudit: 'trip.audit',

  payoutRun: 'payout.run',
  payoutRelease: 'payout.release',
  walletAdjust: 'wallet.adjust',
  rateChange: 'rate.change',

  userCreate: 'user.create',
  userRead: 'user.read',
  userSuspend: 'user.suspend',

  auditRead: 'audit.read',
} as const;

export type AdvertiserPermission =
  (typeof ADVERTISER_PERMISSIONS)[keyof typeof ADVERTISER_PERMISSIONS];
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS];
export type Permission = AdvertiserPermission | AdminPermission;

/**
 * `*` is a wildcard the mock API uses to stand in for a Super Admin holding
 * every permission. The real API always sends the resolved list.
 */
export function hasPermission(granted: readonly string[] | undefined, required: Permission): boolean {
  if (!granted?.length) return false;
  return granted.includes('*') || granted.includes(required);
}

export function hasAnyPermission(
  granted: readonly string[],
  required: readonly Permission[],
): boolean {
  return required.some((p) => hasPermission(granted, p));
}
