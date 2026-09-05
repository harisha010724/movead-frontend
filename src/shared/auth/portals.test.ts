import { describe, expect, it } from 'vitest';

import {
  adminPath,
  currentWebPortal,
  isHomePortal,
  LOGIN_PATH,
  portalLabel,
  portalPath,
} from './portals';

/**
 * Vitest stubs `__PORTAL__` as advertiser, which is the unified-app case:
 * operations live under `/admin`.
 */
describe('portal paths', () => {
  it('puts operations under /admin in the unified app', () => {
    expect(adminPath('/')).toBe('/admin');
    expect(adminPath('/login')).toBe('/admin/login');
    expect(adminPath('/drivers')).toBe('/admin/drivers');
  });

  it('reads the portal from the URL in the unified app', () => {
    expect(currentWebPortal('/')).toBe('advertiser');
    expect(currentWebPortal('/login')).toBe('advertiser');
    expect(currentWebPortal('/admin')).toBe('admin');
    expect(currentWebPortal('/admin/login')).toBe('admin');
    expect(currentWebPortal('/driver')).toBe('driver');
    expect(currentWebPortal('/driver/login')).toBe('driver');
  });

  it('sends each audience to its own dashboard', () => {
    expect(portalPath('advertiser')).toBe('/');
    expect(portalPath('admin')).toBe('/admin');
    expect(portalPath('driver')).toBe('/driver');
  });

  it('answers whether a page the user was heading for is their own product', () => {
    expect(isHomePortal('admin', '/admin/payouts')).toBe(true);
    expect(isHomePortal('admin', '/campaigns')).toBe(false);
    expect(isHomePortal('advertiser', '/campaigns')).toBe(true);
    expect(isHomePortal('advertiser', '/admin/payouts')).toBe(false);
    expect(isHomePortal('driver', '/driver/earnings')).toBe(true);
    expect(isHomePortal('driver', '/campaigns')).toBe(false);
  });

  /**
   * The reason one URL is enough: the account carries its audience, so the
   * same address can serve all three products.
   */
  it('signs every audience in at the same URL', () => {
    expect(LOGIN_PATH).toBe('/login');
  });

  it('names each product the way a message to the user would', () => {
    expect(portalLabel('advertiser')).toBe('advertiser');
    expect(portalLabel('admin')).toBe('operations');
    expect(portalLabel('driver')).toBe('driver');
  });
});
