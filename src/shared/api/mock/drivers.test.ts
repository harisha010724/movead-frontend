import { beforeEach, describe, expect, it } from 'vitest';
import { mockFetch } from './mockFetch';
import { mockDrivers } from './fixtures';

/**
 * The mock stands in for the real endpoint when the admin portal runs offline,
 * so it has to answer with the same shapes and the same refusals. The rules
 * asserted here are the ones the dialog reads: the pending status, and which
 * field a conflict names.
 */
describe('POST /v1/admin/drivers', () => {
  let snapshot: typeof mockDrivers;

  beforeEach(() => {
    snapshot = [...mockDrivers];
    return () => {
      mockDrivers.length = 0;
      mockDrivers.push(...snapshot);
    };
  });

  const create = (registrationNumber: string, name = 'Kavya Reddy', mobile = '9876543210') =>
    mockFetch('POST', '/v1/admin/drivers', {
      name,
      mobile,
      vehicle: { registrationNumber, category: 'CAB' as const },
    });

  it('creates the driver in Pending, so it cannot receive campaigns (AC-04.7)', async () => {
    const response = await create('KA51MN4242');
    expect(response.status).toBe(201);

    const body = (await response.json()) as {
      driver: { status: string; mobile: string };
      vehicle: { registrationNumber: string } | null;
    };
    expect(body.driver.status).toBe('PENDING');
    expect(body.driver.mobile).toBe('9876543210');
    expect(body.vehicle?.registrationNumber).toBe('KA51MN4242');
  });

  it('rejects a duplicate registration number with a conflict (AC-05.7)', async () => {
    const existing = mockDrivers[0]?.vehicle?.registrationNumber ?? 'KA01AB1000';

    const response = await create(existing);
    expect(response.status).toBe(409);

    // The dialog puts the message on the field the server names.
    const body = (await response.json()) as { details: { fields: string[] } };
    expect(body.details.fields).toContain('registration_number');
  });

  it('names the mobile when that is what clashed, not the plate', async () => {
    const taken = mockDrivers[0]?.mobile ?? '9840000000';

    const response = await create('KA51MN4242', 'Kavya Reddy', taken);
    expect(response.status).toBe(409);

    const body = (await response.json()) as { details: { fields: string[] } };
    expect(body.details.fields).toContain('mobile');
  });

  it('does not add a driver when the registration conflicts', async () => {
    const before = mockDrivers.length;
    await create(mockDrivers[0]?.vehicle?.registrationNumber ?? 'KA01AB1000');
    expect(mockDrivers).toHaveLength(before);
  });

  it('shows the new driver at the top of the list', async () => {
    await create('KA51MN4242', 'Kavya Reddy');

    const response = await mockFetch('GET', '/v1/admin/drivers');
    const body = (await response.json()) as { items: { name: string }[] };
    expect(body.items[0]?.name).toBe('Kavya Reddy');
  });
});

describe('editing and removing a driver', () => {
  let snapshot: typeof mockDrivers;

  beforeEach(() => {
    snapshot = mockDrivers.map((driver) => ({ ...driver }));
    return () => {
      mockDrivers.length = 0;
      mockDrivers.push(...snapshot);
    };
  });

  const pending = () => mockDrivers.find((d) => d.status === 'PENDING');

  it('corrects the name of a driver', async () => {
    const driver = pending();
    const response = await mockFetch('PATCH', `/v1/admin/drivers/${driver?.id ?? ''}`, {
      name: 'Corrected Name',
    });

    expect(response.status).toBe(200);
    expect(driver?.name).toBe('Corrected Name');
  });

  it('locks the mobile once the driver is past pending', async () => {
    const settled = mockDrivers.find((d) => d.status === 'APPROVED');

    const response = await mockFetch('PATCH', `/v1/admin/drivers/${settled?.id ?? ''}`, {
      mobile: '9812312312',
    });

    expect(response.status).toBe(422);
  });

  it('removes a driver, taking them out of the list', async () => {
    const driver = pending();
    const before = mockDrivers.length;

    const response = await mockFetch('DELETE', `/v1/admin/drivers/${driver?.id ?? ''}`, {
      reason: 'Duplicate record created during onboarding.',
    });

    expect(response.status).toBe(200);
    expect(mockDrivers).toHaveLength(before - 1);
    expect(mockDrivers.some((d) => d.id === driver?.id)).toBe(false);
  });

  it('refuses a removal with no reason, the way the API does', async () => {
    const driver = pending();
    const before = mockDrivers.length;

    const response = await mockFetch('DELETE', `/v1/admin/drivers/${driver?.id ?? ''}`, {});

    expect(response.status).toBe(400);
    expect(mockDrivers).toHaveLength(before);
  });

  it('frees the mobile and the plate once removed', async () => {
    const driver = pending();
    const mobile = driver?.mobile ?? '';
    const plate = driver?.vehicle?.registrationNumber ?? '';

    await mockFetch('DELETE', `/v1/admin/drivers/${driver?.id ?? ''}`, {
      reason: 'Duplicate record created during onboarding.',
    });

    const reused = await mockFetch('POST', '/v1/admin/drivers', {
      name: 'Same Person Again',
      mobile,
      vehicle: { registrationNumber: plate, category: 'CAB' },
    });

    expect(reused.status).toBe(201);
  });
});
