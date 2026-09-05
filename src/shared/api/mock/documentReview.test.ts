import { beforeEach, describe, expect, it } from 'vitest';
import { mockDrivers } from './fixtures';
import { mockFetch } from './mockFetch';

/**
 * The review endpoints the admin portal calls when it runs offline.
 *
 * The rule worth holding here is the ordering one: a driver cannot be approved
 * while a mandatory document is unverified. The screen disables the button for
 * the same reason, but the disabled button is a courtesy and this is the rule.
 */
describe('reviewing a driver’s documents', () => {
  let snapshot: typeof mockDrivers;

  beforeEach(() => {
    snapshot = mockDrivers.map((driver) => ({ ...driver }));
    return () => {
      mockDrivers.length = 0;
      mockDrivers.push(...snapshot);
    };
  });

  const submitted = () => mockDrivers.find((d) => d.status === 'DOCUMENTS_SUBMITTED');

  interface Detail {
    driver: { id: string; status: string };
    vehicles: { id: string }[];
    driverDocuments: {
      kind: string;
      status: string;
      documentId: string | null;
      contentType: string | null;
      rejectionReason: string | null;
    }[];
    vehicleDocuments: Record<string, { kind: string; status: string }[]>;
  }

  const detailOf = async (id: string): Promise<Detail> => {
    const response = await mockFetch('GET', `/v1/admin/drivers/${id}`);
    return (await response.json()) as Detail;
  };

  it('returns both checklists, because papers belong to a plate and to a person', async () => {
    const driver = submitted();
    const detail = await detailOf(driver?.id ?? '');

    expect(detail.driverDocuments.map((item) => item.kind)).toEqual(['LICENCE']);
    expect(Object.values(detail.vehicleDocuments)[0]?.map((item) => item.kind)).toEqual([
      'RC',
      'INSURANCE',
      'POLLUTION',
      'PERMIT',
    ]);
  });

  it('says what kind of file each one is, so the screen can pick a viewer', async () => {
    const detail = await detailOf(submitted()?.id ?? '');

    for (const item of detail.driverDocuments) {
      expect(item.contentType).toMatch(/^(image\/jpeg|application\/pdf)$/);
    }
  });

  it('is a 404 for a driver who does not exist', async () => {
    const response = await mockFetch('GET', '/v1/admin/drivers/drv_nope');
    expect(response.status).toBe(404);
  });

  it('records a verification against the document', async () => {
    const detail = await detailOf(submitted()?.id ?? '');
    const documentId = detail.driverDocuments[0]?.documentId ?? '';

    const response = await mockFetch('POST', `/v1/admin/documents/${documentId}/verify`);
    expect(response.status).toBe(200);

    const after = await detailOf(detail.driver.id);
    expect(after.driverDocuments[0]?.status).toBe('verified');
  });

  it('keeps the reason on a rejection, because the driver only sees that', async () => {
    const detail = await detailOf(submitted()?.id ?? '');
    const documentId = detail.driverDocuments[0]?.documentId ?? '';

    await mockFetch('POST', `/v1/admin/documents/${documentId}/reject`, {
      reason: 'The expiry date is cut off. Send a photo of the whole licence.',
    });

    const after = await detailOf(detail.driver.id);
    expect(after.driverDocuments[0]).toMatchObject({
      status: 'rejected',
      rejectionReason: 'The expiry date is cut off. Send a photo of the whole licence.',
    });
  });

  it('refuses a rejection with no reason', async () => {
    const detail = await detailOf(submitted()?.id ?? '');
    const documentId = detail.driverDocuments[0]?.documentId ?? '';

    const response = await mockFetch('POST', `/v1/admin/documents/${documentId}/reject`, {
      reason: 'bad',
    });

    expect(response.status).toBe(400);
  });

  it('refuses to approve a driver whose licence has not been looked at', async () => {
    const driver = submitted();

    const response = await mockFetch('POST', `/v1/admin/drivers/${driver?.id ?? ''}/approve`);

    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('documents_outstanding');
    expect(driver?.status).toBe('DOCUMENTS_SUBMITTED');
  });

  it('approves them once it has been', async () => {
    const driver = submitted();
    const detail = await detailOf(driver?.id ?? '');

    for (const item of detail.driverDocuments) {
      await mockFetch('POST', `/v1/admin/documents/${item.documentId ?? ''}/verify`);
    }

    const response = await mockFetch('POST', `/v1/admin/drivers/${driver?.id ?? ''}/approve`);
    expect(response.status).toBe(200);
    expect(driver?.status).toBe('APPROVED');
  });

  it('sends a rejected driver back to pending, so they have something to resubmit into', async () => {
    const driver = submitted();

    const response = await mockFetch('POST', `/v1/admin/drivers/${driver?.id ?? ''}/reject`, {
      reason: 'The licence and the registration are in different names.',
    });

    expect(response.status).toBe(200);
    expect(driver?.status).toBe('PENDING');
  });
});
