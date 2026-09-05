import { describe, expect, it } from 'vitest';

import {
  acceptInvitationSchema,
  editAdvertiserSchema,
  normaliseTaxId,
  onboardAdvertiserSchema,
} from './advertiserSchema';

const valid = {
  legalName: 'Zephyr Beverages Private Limited',
  brandName: 'Zephyr',
  billingEmail: 'accounts@zephyr.example',
  gstin: '',
  pan: '',
  contactName: 'Priya Buyer',
  contactEmail: 'buyer@zephyr.example',
};

function errorFor(input: Record<string, unknown>, field: string): string | undefined {
  const result = onboardAdvertiserSchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe('onboardAdvertiserSchema', () => {
  it('accepts an advertiser with only the compulsory fields', () => {
    expect(onboardAdvertiserSchema.safeParse(valid).success).toBe(true);
  });

  it('treats an untouched GSTIN as absent rather than invalid', () => {
    // An operator on a call should not be blocked because finance has not sent
    // the certificate through yet.
    const result = onboardAdvertiserSchema.safeParse(valid);
    expect(result.success && result.data.gstin).toBeNull();
    expect(result.success && result.data.pan).toBeNull();
  });

  it.each([
    ['29abcde1234f1z5', '29ABCDE1234F1Z5'],
    ['29 ABCDE 1234 F1Z5', '29ABCDE1234F1Z5'],
  ])('normalises the GSTIN %s to %s', (input, expected) => {
    const result = onboardAdvertiserSchema.safeParse({ ...valid, gstin: input });
    expect(result.success && result.data.gstin).toBe(expected);
  });

  it('rejects a GSTIN of the wrong shape once one is typed', () => {
    expect(errorFor({ ...valid, gstin: '29ABCDE' }, 'gstin')).toMatch(/15-character/);
  });

  it('rejects a PAN of the wrong shape', () => {
    expect(errorFor({ ...valid, pan: 'ABCDE12345' }, 'pan')).toMatch(/10-character/);
  });

  it('lowercases both email addresses, because the server treats them as one', () => {
    const result = onboardAdvertiserSchema.safeParse({
      ...valid,
      billingEmail: 'Accounts@Zephyr.Example',
      contactEmail: 'Buyer@Zephyr.Example',
    });

    expect(result.success && result.data.billingEmail).toBe('accounts@zephyr.example');
    expect(result.success && result.data.contactEmail).toBe('buyer@zephyr.example');
  });

  it.each(['legalName', 'brandName', 'billingEmail', 'contactName', 'contactEmail'])(
    'requires %s',
    (field) => {
      expect(errorFor({ ...valid, [field]: '' }, field)).toBeDefined();
    },
  );

  it('rejects an address that is not an email', () => {
    expect(errorFor({ ...valid, contactEmail: 'priya.buyer' }, 'contactEmail')).toMatch(
      /valid/,
    );
  });
});

describe('editAdvertiserSchema', () => {
  const company = {
    legalName: valid.legalName,
    brandName: valid.brandName,
    billingEmail: valid.billingEmail,
    gstin: '29ABCDE1234F1Z5',
    pan: '',
    contactName: valid.contactName,
    contactEmail: valid.contactEmail,
  };

  it('accepts an account with a company and a contact', () => {
    expect(editAdvertiserSchema.safeParse(company).success).toBe(true);
  });

  it('asks for no contact when the account has none', () => {
    // Both blank is the shape of an advertiser opened without a user. Demanding
    // a person who does not exist would make the company uneditable.
    const result = editAdvertiserSchema.safeParse({
      ...company,
      contactName: '',
      contactEmail: '',
    });
    expect(result.success).toBe(true);
  });

  it('validates the contact once there is one', () => {
    const result = editAdvertiserSchema.safeParse({ ...company, contactEmail: 'not-an-address' });
    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues[0]?.path).toEqual(['contactEmail']);
  });

  it('lowercases the contact address, because the server treats it as one', () => {
    const result = editAdvertiserSchema.safeParse({
      ...company,
      contactEmail: 'Buyer@Zephyr.Example',
    });
    expect(result.success && result.data.contactEmail).toBe('buyer@zephyr.example');
  });

  it('clears a tax identifier that has been emptied', () => {
    const result = editAdvertiserSchema.safeParse({ ...company, gstin: '' });
    // Null rather than '', which is what tells the API to remove it.
    expect(result.success && result.data.gstin).toBeNull();
  });

  it('keeps the onboarding rules it inherited', () => {
    expect(editAdvertiserSchema.safeParse({ ...company, gstin: '29ABCDE' }).success).toBe(false);
    expect(editAdvertiserSchema.safeParse({ ...company, legalName: '' }).success).toBe(false);
  });
});

describe('acceptInvitationSchema', () => {
  it('accepts a long password typed twice', () => {
    const result = acceptInvitationSchema.safeParse({
      password: 'a-password-they-chose',
      confirm: 'a-password-they-chose',
    });
    expect(result.success).toBe(true);
  });

  it('requires twelve characters', () => {
    const result = acceptInvitationSchema.safeParse({ password: 'short', confirm: 'short' });
    expect(result.success).toBe(false);
  });

  it('puts a mismatch on the confirmation, not the password', () => {
    const result = acceptInvitationSchema.safeParse({
      password: 'a-password-they-chose',
      confirm: 'a-different-password-entirely',
    });

    // The field the person should retype is the second one.
    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues[0]?.path).toEqual(['confirm']);
  });

  it('has no composition rule, on purpose', () => {
    // A rule demanding one capital and one symbol narrows what an attacker has
    // to search and pushes people toward Password1!. Length is the requirement.
    const result = acceptInvitationSchema.safeParse({
      password: 'correct horse battery staple',
      confirm: 'correct horse battery staple',
    });
    expect(result.success).toBe(true);
  });
});

describe('normaliseTaxId', () => {
  it('strips what people paste out of a certificate', () => {
    expect(normaliseTaxId(' 29-abcde 1234f1z5 ')).toBe('29ABCDE1234F1Z5');
  });
});
