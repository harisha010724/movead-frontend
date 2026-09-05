import { z } from 'zod';

/**
 * Onboarding an advertiser (AC-32.2).
 *
 * Six fields, and only three are compulsory: who they are legally, what they
 * trade as, and where invoices go. GSTIN and PAN are asked for because billing
 * will need them, but an operator on a call should not be blocked from opening
 * an account because the finance contact has not sent them through yet.
 *
 * There is no password field, and there is not meant to be one. The contact is
 * emailed a single-use link and chooses their own — see the backend's migration
 * 009 for why that is worth the extra screen.
 */

/** Uppercases and strips the spaces people paste out of a certificate. */
export function normaliseTaxId(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

/**
 * Two digits of state code, the PAN, an entity number, a fixed Z, and a check
 * character. Validated again by a CHECK constraint in the database; this copy
 * exists to say which character is wrong before a round trip.
 */
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/;
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** Optional text fields arrive as '' from an untouched input, not undefined. */
const blankToNull = (value: string) => (value.trim() === '' ? null : normaliseTaxId(value));

export const onboardAdvertiserSchema = z.object({
  legalName: z
    .string()
    .trim()
    .min(2, 'Enter the registered legal name')
    .max(200, 'Legal name must be 200 characters or fewer'),
  brandName: z
    .string()
    .trim()
    .min(1, 'Enter the name they trade as')
    .max(120, 'Brand name must be 120 characters or fewer'),
  billingEmail: z
    .string()
    .trim()
    .min(1, 'Enter an email for invoices')
    .pipe(z.email('Enter a valid email address'))
    .transform((value) => value.toLowerCase()),
  gstin: z
    .string()
    .transform(blankToNull)
    .refine(
      (v) => v === null || GSTIN.test(v),
      'Use the 15-character GSTIN, e.g. 29ABCDE1234F1Z5',
    ),
  pan: z
    .string()
    .transform(blankToNull)
    .refine((v) => v === null || PAN.test(v), 'Use the 10-character PAN, e.g. ABCDE1234F'),

  contactName: z
    .string()
    .trim()
    .min(2, 'Enter the name of their first user')
    .max(120, 'Name must be 120 characters or fewer'),
  contactEmail: z
    .string()
    .trim()
    .min(1, 'Enter the address the invitation goes to')
    .pipe(z.email('Enter a valid email address'))
    .transform((value) => value.toLowerCase()),
});

export type OnboardAdvertiserValues = z.input<typeof onboardAdvertiserSchema>;
export type OnboardAdvertiserPayload = z.output<typeof onboardAdvertiserSchema>;

/**
 * Correcting the account afterwards — the company and the person on it.
 *
 * The contact is here because the commonest thing to get wrong at onboarding is
 * their email, and that is precisely the mistake nobody can recover from: the
 * invitation went to an address that does not exist, so the customer cannot get
 * in and cannot tell you. The consequences are not the same as fixing a
 * spelling, though, so the API treats an address change as a security event and
 * the dialog says what it will do before it does it.
 *
 * Both contact fields are blank when the account has no user at all, and the
 * dialog does not render them; the refinement below skips validation in that
 * case rather than demanding a person who does not exist.
 */
export const editAdvertiserSchema = onboardAdvertiserSchema
  .pick({
    legalName: true,
    brandName: true,
    billingEmail: true,
    gstin: true,
    pan: true,
  })
  .extend({
    contactName: z.string().trim().max(120, 'Name must be 120 characters or fewer'),
    contactEmail: z
      .string()
      .trim()
      .max(254)
      .transform((value) => value.toLowerCase()),
  })
  .superRefine((values, ctx) => {
    const absent = values.contactName === '' && values.contactEmail === '';
    if (absent) return;

    if (values.contactName.length < 2) {
      ctx.addIssue({ code: 'custom', path: ['contactName'], message: 'Enter their name' });
    }

    if (!z.email().safeParse(values.contactEmail).success) {
      ctx.addIssue({
        code: 'custom',
        path: ['contactEmail'],
        message: 'Enter a valid email address',
      });
    }
  });

export type EditAdvertiserValues = z.input<typeof editAdvertiserSchema>;
export type EditAdvertiserPayload = z.output<typeof editAdvertiserSchema>;

/**
 * Setting a password from an invitation.
 *
 * Twelve characters and nothing else. A composition rule — one capital, one
 * digit, one symbol — narrows the search space an attacker has to cover and
 * pushes people toward `Password1!`, so length is the requirement and the rest
 * is left to them.
 */
export const acceptInvitationSchema = z
  .object({
    password: z
      .string()
      .min(12, 'Use at least 12 characters')
      .max(200, 'Keep it under 200 characters'),
    confirm: z.string().min(1, 'Type the password again'),
  })
  .refine((values) => values.password === values.confirm, {
    message: 'The two passwords do not match',
    path: ['confirm'],
  });

export type AcceptInvitationValues = z.infer<typeof acceptInvitationSchema>;
