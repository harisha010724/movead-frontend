import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Send, Smartphone } from 'lucide-react';
import { api } from '@/shared/api/client';
import { ApiError, toDisplayMessage } from '@/shared/api/errors';
import { queryKeys } from '@/shared/api/queryKeys';
import { formatRegistration } from '@/shared/format';
import { VALIDATION_MODE } from '@/shared/lib/formConfig';
import { Button, Dialog } from '@/shared/ui';
import { LocationPinPicker } from '@/shared/maps/LocationPinPicker';
import { FormError, SelectField, TextField } from '@/shared/ui/form';
import {
  onboardDriverSchema,
  type OnboardDriverPayload,
  type OnboardDriverValues,
} from './driverSchema';

interface CreatedDriver {
  driver: { id: string; name: string; mobile: string; status: string };
  vehicle: { id: string; registrationNumber: string } | null;
  user: { email: string; status: string } | null;
  invitationEmailed: boolean;
}

interface OnboardedDriver {
  name: string;
  email: string;
  registrationNumber: string;
  invitationEmailed: boolean;
}

const VEHICLE_TYPES = [
  { value: 'CAB', label: 'Cab' },
  { value: 'AUTO', label: 'Auto' },
];

const CITIES = [{ value: 'Bengaluru', label: 'Bengaluru' }];

const EMPTY: OnboardDriverValues = {
  name: '',
  mobile: '',
  email: '',
  vehicleType: 'CAB',
  registrationNumber: '',
  city: 'Bengaluru',
  location: { label: '', lat: 0, lng: 0 },
};

/**
 * AC-32.1: admin creates the driver account. AC-04 lists ten things a complete
 * registration needs, and the admin can legitimately supply only four of them.
 *
 * The OTP goes to the driver's handset, and the profile photo, licence, vehicle
 * documents and payout details are theirs to provide. Location consent must be
 * given by the driver after seeing what is collected and why (AC-04.3, AC-04.4)
 * — an admin ticking that box on someone else's behalf would not be consent.
 *
 * So this captures identity and vehicle, then invites the driver to finish on
 * their phone. The account is created in Pending and cannot receive campaigns
 * or accrue billable kilometres until documents are verified (AC-04.7, AC-05).
 */
export function OnboardDriverDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [onboarded, setOnboarded] = useState<OnboardedDriver | null>(null);

  const form = useForm<OnboardDriverValues>({
    resolver: zodResolver(onboardDriverSchema),
    ...VALIDATION_MODE,
    defaultValues: EMPTY,
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors },
  } = form;

  const city = watch('city');

  // Reset only once the closing animation cannot show the cleared form.
  useEffect(() => {
    if (open) return;
    const timer = setTimeout(() => {
      reset(EMPTY);
      setOnboarded(null);
    }, 200);
    return () => clearTimeout(timer);
  }, [open, reset]);

  /*
   * One request, because the API creates the driver and the vehicle in a single
   * transaction. The pin is stored on the driver so campaign create can match
   * vehicles to Prime and Secondary without a live GPS fix.
   */
  const create = useMutation({
    mutationFn: (values: OnboardDriverPayload) =>
      api.post<CreatedDriver>('/v1/admin/drivers', {
        name: values.name,
        mobile: values.mobile,
        email: values.email,
        location: {
          city: values.city,
          label: values.location.label,
          lat: values.location.lat,
          lng: values.location.lng,
        },
        vehicle: {
          registrationNumber: values.registrationNumber,
          category: values.vehicleType,
        },
      }),
    onSuccess: async (created, values) => {
      setOnboarded({
        name: created.driver.name,
        email: created.user?.email ?? values.email,
        registrationNumber: created.vehicle?.registrationNumber ?? values.registrationNumber,
        invitationEmailed: created.invitationEmailed,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.drivers.all() });
    },
    onError: (error) => {
      /*
       * Two things are unique and only the server knows either: the mobile
       * number and, platform-wide, the registration (AC-05.7). Put the message
       * on the field that caused it rather than in the form-level banner, where
       * the admin has to work out which of five inputs to change.
       *
       * The response says which field clashed, and the guess when it does not
       * is the plate — it is the one an admin is most likely to mistype.
       */
      if (error instanceof ApiError && error.isConflict) {
        const named = error.fields;
        const clashedOnEmail = named.length
          ? named.some((field) => /email/i.test(field))
          : /email/i.test(error.message);
        const clashedOnMobile = named.length
          ? named.some((field) => /mobile/i.test(field))
          : /mobile/i.test(error.message);

        if (clashedOnEmail) {
          setError('email', { message: 'This email is already registered' });
        } else if (clashedOnMobile) {
          setError('mobile', { message: 'A driver with this mobile number already exists' });
        } else {
          setError('registrationNumber', {
            message: 'This vehicle is already registered on the platform',
          });
        }
      }
    },
  });

  const startAnother = () => {
    reset(EMPTY);
    setOnboarded(null);
    create.reset();
  };

  if (onboarded) {
    return (
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title="Driver onboarded"
        description={`${onboarded.name} has been created. Their username and password were emailed.`}
        footer={
          <>
            <Button variant="secondary" onClick={startAnother}>
              Onboard another
            </Button>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </>
        }
      >
        <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
          <div className="text-[13px] text-emerald-900">
            <p className="font-medium">
              {onboarded.invitationEmailed
                ? 'Login details sent to '
                : 'Account created. Login email could not be sent to '}
              <span className="font-medium">{onboarded.email}</span>
            </p>
            <p className="mt-1 text-emerald-800">
              Vehicle{' '}
              <span className="numeric font-medium">
                {formatRegistration(onboarded.registrationNumber)}
              </span>{' '}
              is reserved for this driver.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-[13px] font-medium text-slate-800">What happens next</p>
          <ol className="mt-2.5 space-y-2.5 text-[13px] text-slate-600">
            {[
              'The driver opens the email and signs in at the driver portal with the username and password.',
              'They upload a profile photo, driving licence, RC and insurance, and add payout details.',
              'They give location tracking consent after seeing what is collected and why.',
              'You verify the documents, then approve the vehicle.',
            ].map((step, index) => (
              <li key={step} className="flex gap-2.5">
                <span className="numeric mt-px grid size-5 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-[11px] text-slate-400">
            The driver stays in Pending and cannot receive campaigns or earn kilometres until you
            approve the vehicle.
          </p>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Onboard driver"
      description="Capture the driver, their sign-in email, vehicle and usual operating area. They get a mail with a username and password."
      size="xl"
      dismissible={!create.isPending}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="onboard-driver"
            loading={create.isPending}
            leadingIcon={<Send className="size-4" />}
          >
            Create and invite
          </Button>
        </>
      }
    >
      {/*
        Two columns from `lg`: who and what on the left, where on the right.
        Stacked, the map sat below five fields and pushed the whole form past
        the viewport, so choosing a pin meant scrolling away from everything
        already typed. Side by side the form fits without scrolling, and the map
        gets the room it needs to be worth clicking on.

        The form column is a fixed width and the map takes whatever is left,
        rather than the two splitting the dialog in some ratio. A text input
        stops getting easier to read past about 350px, so widening the dialog
        should widen the map and nothing else — every pixel it gains is another
        street the admin can recognise before dropping the pin.
      */}
      <form
        id="onboard-driver"
        noValidate
        onSubmit={(event) => void handleSubmit((values) => create.mutate(values))(event)}
        className="grid items-start gap-x-8 gap-y-5 lg:grid-cols-[22rem_minmax(0,1fr)]"
      >
        <div className="space-y-5">
          <TextField
            label="Full name"
            required
            autoFocus
            autoComplete="off"
            placeholder="Ramesh Babu"
            error={errors.name?.message}
            {...register('name')}
          />

          <TextField
            label="Mobile number"
            required
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            placeholder="98765 43210"
            hint="Indian mobile. Used for operations contact, not for sign-in."
            error={errors.mobile?.message}
            {...register('mobile')}
          />

          <TextField
            label="Email"
            required
            type="email"
            autoComplete="off"
            placeholder="rahul@example.com"
            hint="This is the driver’s username. The password is emailed here."
            error={errors.email?.message}
            {...register('email')}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Controller
              control={control}
              name="vehicleType"
              render={({ field, fieldState }) => (
                <SelectField
                  label="Vehicle type"
                  required
                  options={VEHICLE_TYPES}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  {...(fieldState.error?.message ? { error: fieldState.error.message } : {})}
                />
              )}
            />

            <Controller
              control={control}
              name="city"
              render={({ field, fieldState }) => (
                <SelectField
                  label="City"
                  required
                  options={CITIES}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  hint="One city during the pilot."
                  {...(fieldState.error?.message ? { error: fieldState.error.message } : {})}
                />
              )}
            />
          </div>

          <TextField
            label="Vehicle registration"
            required
            autoComplete="off"
            placeholder="KA 01 AB 1234"
            className="uppercase"
            hint="Must be unique on the platform."
            error={errors.registrationNumber?.message}
            {...register('registrationNumber')}
          />
        </div>

        <div>
          <p className="mb-1.5 text-[13px] font-medium text-slate-800">
            Operating area <span className="text-rose-500">*</span>
          </p>
          <p className="mb-2.5 text-[12px] text-slate-500">
            Drop a pin where this driver usually works. Advertisers see the vehicle when that pin
            sits inside their Prime or Secondary outline.
          </p>
          <Controller
            control={control}
            name="location"
            render={({ field, fieldState }) => (
              <LocationPinPicker
                city={city || 'Bengaluru'}
                value={field.value?.label ? field.value : null}
                onChange={(next) => field.onChange(next ?? { label: '', lat: 0, lng: 0 })}
                error={fieldState.error?.message ?? errors.location?.label?.message}
                active={open}
                // Roughly the height of the five fields beside it, so neither
                // column trails a strip of white space.
                mapClassName="h-56 lg:h-80"
              />
            )}
          />
        </div>

        {/* Both of these belong to the form, not to either column. */}
        <div className="space-y-5 lg:col-span-2">
          {/* A conflict is already reported under the registration field. */}
          {create.isError && !(create.error instanceof ApiError && create.error.isConflict) ? (
            <FormError message={toDisplayMessage(create.error)} />
          ) : null}

          <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
            <Smartphone className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
            <p className="text-[11px] text-slate-500">
              The driver completes the rest after they sign in: profile photo, licence, RC and
              insurance, payout details, and location tracking consent. Consent has to be given by
              the driver after seeing what is collected, so it cannot be recorded here.
            </p>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
