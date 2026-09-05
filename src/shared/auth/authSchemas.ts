import { z } from 'zod';

/**
 * Sign-in is email and password, matching `POST /v1/auth/login`. Accounts are
 * created by an administrator against a work address, so an email is the one
 * identifier every user is guaranteed to have and to remember.
 *
 * Nothing here hints at whether an address is registered. "No account with that
 * email" tells an attacker which addresses are worth guessing a password for, so
 * a failed sign-in returns one message for both cases.
 */
export const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Enter your email address')
    .pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Enter your password'),
});

/** The second factor. Mandatory for admin (ADM-001), optional for advertisers. */
export const mfaSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Enter your verification code')
    .regex(/^\d{6}$/, 'The code is six digits'),
});

export type CredentialsValues = z.input<typeof credentialsSchema>;
export type MfaValues = z.input<typeof mfaSchema>;
