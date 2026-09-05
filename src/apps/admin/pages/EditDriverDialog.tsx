import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { api } from '@/shared/api/client';
import { ApiError, toDisplayMessage } from '@/shared/api/errors';
import type { DriverListing } from '@/shared/api/hooks';
import { queryKeys } from '@/shared/api/queryKeys';
import { VALIDATION_MODE } from '@/shared/lib/formConfig';
import { LocationPinPicker } from '@/shared/maps/LocationPinPicker';
import { Button, Dialog } from '@/shared/ui';
import { FormError, SelectField, TextField } from '@/shared/ui/form';
import { editDriverSchema, type EditDriverPayload, type EditDriverValues } from './driverSchema';

const VEHICLE_TYPES = [
  { value: 'CAB', label: 'Cab' },
  { value: 'AUTO', label: 'Auto' },
];

/**
 * Corrects what onboarding captured.
 *
 * Two of the four fields are only editable early, and the server is the one
 * enforcing it: the mobile locks once the driver has signed in with it, and the
 * plate locks once documents have been verified against it. Rather than hide
 * the inputs on a guess, the dialog disables them from the status it already
 * knows and explains why — a disabled field with a reason teaches the rule, a
 * missing one just looks broken.
 */
export function EditDriverDialog({
  driver,
  onOpenChange,
}: {
  driver: DriverListing | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const form = useForm<EditDriverValues>({
    resolver: zodResolver(editDriverSchema),
    ...VALIDATION_MODE,
    defaultValues: {
      name: '',
      mobile: '',
      vehicleType: 'CAB',
      registrationNumber: '',
      location: { label: '', lat: 0, lng: 0 },
    },
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = form;

  // Load the row being edited. Keyed on the id so switching rows refills.
  useEffect(() => {
    if (!driver) return;
    reset({
      name: driver.name,
      mobile: driver.mobile,
      vehicleType: driver.vehicle?.category ?? 'CAB',
      registrationNumber: driver.vehicle?.registrationNumber ?? '',
      location: driver.location
        ? { label: driver.location.label, lat: driver.location.lat, lng: driver.location.lng }
        : { label: '', lat: 0, lng: 0 },
    });
  }, [driver, reset]);

  const mobileLocked = driver !== null && driver.status !== 'PENDING';
  const plateLocked = driver?.vehicle != null && driver.vehicle.status !== 'PENDING';

  const save = useMutation({
    mutationFn: async (values: EditDriverPayload) => {
      if (!driver) return;

      /*
       * Two endpoints because they are two records, and only the changed ones
       * are called — sending an unchanged plate to a locked vehicle would be
       * refused with a 422 for a correction the admin never asked to make.
       */
      const driverChanges: Record<string, unknown> = {};
      if (values.name !== driver.name) driverChanges.name = values.name;
      if (!mobileLocked && values.mobile !== driver.mobile) driverChanges.mobile = values.mobile;
      if (
        values.location.label &&
        (values.location.label !== driver.location?.label ||
          values.location.lat !== driver.location?.lat ||
          values.location.lng !== driver.location?.lng)
      ) {
        driverChanges.location = {
          city: driver.location?.city ?? 'Bengaluru',
          label: values.location.label,
          lat: values.location.lat,
          lng: values.location.lng,
        };
      }

      if (Object.keys(driverChanges).length > 0) {
        await api.patch(`/v1/admin/drivers/${driver.id}`, driverChanges);
      }

      const vehicle = driver.vehicle;
      if (vehicle && !plateLocked) {
        const vehicleChanges: Record<string, string> = {};
        if (values.registrationNumber !== vehicle.registrationNumber) {
          vehicleChanges.registrationNumber = values.registrationNumber;
        }
        if (values.vehicleType !== vehicle.category) vehicleChanges.category = values.vehicleType;

        if (Object.keys(vehicleChanges).length > 0) {
          await api.patch(`/v1/admin/vehicles/${vehicle.id}`, vehicleChanges);
        }
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.drivers.all() });
      onOpenChange(false);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.isConflict) {
        const named = error.fields;
        const clashedOnMobile = named.length
          ? named.some((field) => /mobile/i.test(field))
          : /mobile/i.test(error.message);

        if (clashedOnMobile) {
          setError('mobile', { message: 'A driver with this mobile number already exists' });
        } else {
          setError('registrationNumber', {
            message: 'This vehicle is already registered on the platform',
          });
        }
      }
    },
  });

  return (
    <Dialog
      open={driver !== null}
      onOpenChange={onOpenChange}
      title="Edit driver"
      description="Correct what was captured at onboarding."
      size="xl"
      dismissible={!save.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-driver"
            loading={save.isPending}
            leadingIcon={<Save className="size-4" />}
          >
            Save changes
          </Button>
        </>
      }
    >
      {/* Same split as onboarding, so the two forms read as one pair. */}
      <form
        id="edit-driver"
        noValidate
        onSubmit={(event) => void handleSubmit((values) => save.mutate(values))(event)}
        className="grid items-start gap-x-8 gap-y-5 lg:grid-cols-[22rem_minmax(0,1fr)]"
      >
        <div className="space-y-5">
          <TextField
            label="Full name"
            required
            autoComplete="off"
            error={errors.name?.message}
            {...register('name')}
          />

          <TextField
            label="Mobile number"
            required
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            disabled={mobileLocked}
            hint={
              mobileLocked
                ? 'Locked. The driver has signed in with this number, so changing it would lock them out.'
                : 'This is the driver’s login and where the invitation is sent.'
            }
            error={errors.mobile?.message}
            {...register('mobile')}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Controller
              control={control}
              name="vehicleType"
              render={({ field, fieldState }) => (
                <SelectField
                  label="Vehicle type"
                  required
                  disabled={plateLocked || !driver?.vehicle}
                  options={VEHICLE_TYPES}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  {...(fieldState.error?.message ? { error: fieldState.error.message } : {})}
                />
              )}
            />

            <TextField
              label="Vehicle registration"
              required
              autoComplete="off"
              className="uppercase"
              disabled={plateLocked || !driver?.vehicle}
              hint={
                plateLocked
                  ? 'Locked. Documents were verified against this plate.'
                  : !driver?.vehicle
                    ? 'No vehicle on this driver yet.'
                    : undefined
              }
              error={errors.registrationNumber?.message}
              {...register('registrationNumber')}
            />
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[13px] font-medium text-slate-800">Operating area</p>
          <Controller
            control={control}
            name="location"
            render={({ field, fieldState }) => (
              <LocationPinPicker
                city={driver?.location?.city ?? 'Bengaluru'}
                value={field.value?.label ? field.value : null}
                onChange={(next) => field.onChange(next ?? { label: '', lat: 0, lng: 0 })}
                error={fieldState.error?.message}
                active={driver !== null}
              />
            )}
          />
        </div>

        {save.isError && !(save.error instanceof ApiError && save.error.isConflict) ? (
          <FormError message={toDisplayMessage(save.error)} className="lg:col-span-2" />
        ) : null}
      </form>
    </Dialog>
  );
}
