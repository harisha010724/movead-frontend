import { describe, expect, it } from 'vitest';
import { usesMockApi } from './env';

/**
 * Both bundles read one env file, so this value decides which backend each
 * portal talks to. Getting it wrong is quiet rather than loud: the portal keeps
 * working, on the wrong data.
 */
describe('usesMockApi', () => {
  it('treats true and false as applying to both portals', () => {
    expect(usesMockApi('true', 'admin', false)).toBe(true);
    expect(usesMockApi('true', 'advertiser', false)).toBe(true);
    expect(usesMockApi('false', 'admin', false)).toBe(false);
    expect(usesMockApi('false', 'advertiser', false)).toBe(false);
  });

  it('names one portal without affecting the other', () => {
    expect(usesMockApi('advertiser', 'advertiser', false)).toBe(true);
    expect(usesMockApi('advertiser', 'admin', false)).toBe(false);
    expect(usesMockApi('advertiser,driver', 'driver', false)).toBe(true);
    expect(usesMockApi('advertiser,driver', 'admin', false)).toBe(false);
  });

  it('accepts both portals as a list', () => {
    expect(usesMockApi('advertiser,admin', 'admin', false)).toBe(true);
    expect(usesMockApi('advertiser, admin', 'admin', false)).toBe(true);
  });

  it('defaults to the real API when unset or blank', () => {
    expect(usesMockApi(undefined, 'admin', false)).toBe(false);
    expect(usesMockApi('   ', 'admin', false)).toBe(false);
  });

  it('is never enabled in production, whatever it says', () => {
    expect(usesMockApi('true', 'admin', true)).toBe(false);
    expect(usesMockApi('advertiser', 'advertiser', true)).toBe(false);
  });

  it('does not match a portal by accident', () => {
    // A substring match would make `administrator` enable the admin portal.
    expect(usesMockApi('administrator', 'admin', false)).toBe(false);
    expect(usesMockApi('', 'advertiser', false)).toBe(false);
  });
});
