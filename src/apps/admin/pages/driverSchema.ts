import { z } from 'zod';
import { normaliseRegistration } from '@/shared/format';

/** Strips spaces, hyphens and a +91 or 0 prefix, leaving the 10 national digits. */
export function normaliseMobile(input: string): string {
  const digits = input.replace(/[\s-()]/g, '').replace(/^\+?91/, '').replace(/^0/, '');
  return digits;
}

/*
 * State code, RTO number, series letters, then four digits — KA 01 AB 1234.
 * The series is one to three letters and the RTO one or two digits, so older
 * plates such as KA 5 A 1234 are accepted alongside current ones.
 */
const REGISTRATION = /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$/;

/** Indian mobile numbers are ten digits and begin 6, 7, 8 or 9. */
const MOBILE = /^[6-9]\d{9}$/;

export const onboardDriverSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Enter the driver’s full name')
    .max(80, 'Name must be 80 characters or fewer'),
  mobile: z
    .string()
    .min(1, 'Enter a mobile number')
    .transform(normaliseMobile)
    .refine((v) => MOBILE.test(v), 'Enter a 10-digit Indian mobile number starting 6, 7, 8 or 9'),
  email: z
    .string()
    .trim()
    .min(1, 'Enter the driver’s email')
    .pipe(z.email('Enter a valid email address'))
    .transform((value) => value.toLowerCase()),
  vehicleType: z.enum(['AUTO', 'CAB'], { message: 'Select a vehicle type' }),
  registrationNumber: z
    .string()
    .min(1, 'Enter the vehicle registration number')
    .transform(normaliseRegistration)
    .refine((v) => REGISTRATION.test(v), 'Use the format KA 01 AB 1234'),
  city: z.string().min(1, 'Select a city'),
  location: z.object(
    {
      label: z.string().min(1, 'Search or click the map to drop the driver’s pin'),
      lat: z.number().gte(-90).lte(90),
      lng: z.number().gte(-180).lte(180),
    },
    { message: 'Search or click the map to drop the driver’s pin' },
  ),
});

export type OnboardDriverValues = z.input<typeof onboardDriverSchema>;
export type OnboardDriverPayload = z.output<typeof onboardDriverSchema>;

/**
 * Editing is onboarding without the city picker — city travels with the pin.
 *
 * The same identity fields, validated the same way, because an edit exists to
 * fix what onboarding captured — usually a mistyped plate, a digit wrong in
 * the mobile number, or a missing operating pin.
 */
export const editDriverSchema = onboardDriverSchema.omit({ city: true, email: true });

export type EditDriverValues = z.input<typeof editDriverSchema>;
export type EditDriverPayload = z.output<typeof editDriverSchema>;

/**
 * The API requires ten characters, and says so in the same words the driver
 * would read. Matching the rule here means the refusal arrives before the
 * request rather than as a 400 the admin has to interpret.
 */
export const removeDriverSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, 'Give a reason of at least 10 characters — it is the only record of why')
    .max(500, 'Keep the reason under 500 characters'),
});

export type RemoveDriverValues = z.infer<typeof removeDriverSchema>;
