import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { api } from '@/shared/api/client';
import { toDisplayMessage } from '@/shared/api/errors';
import type { DriverListing } from '@/shared/api/hooks';
import { queryKeys } from '@/shared/api/queryKeys';
import { formatRegistration } from '@/shared/format';
import { VALIDATION_MODE } from '@/shared/lib/formConfig';
import { Button, Dialog } from '@/shared/ui';
import { FormError, TextareaField } from '@/shared/ui/form';
import { removeDriverSchema, type RemoveDriverValues } from './driverSchema';

/**
 * Removing a driver from the platform.
 *
 * The API archives rather than erases, because the audit trail references the
 * driver and is append-only (AC-31.5). That is worth saying on the screen: an
 * admin who believes they have destroyed a record behaves differently from one
 * who knows it is filed away, and only one of those beliefs is true.
 *
 * The reason is mandatory for the same purpose it is mandatory on a rejection —
 * it is the only place the decision will ever be explained.
 */
export function RemoveDriverDialog({
  driver,
  onOpenChange,
}: {
  driver: DriverListing | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const form = useForm<RemoveDriverValues>({
    resolver: zodResolver(removeDriverSchema),
    ...VALIDATION_MODE,
    defaultValues: { reason: '' },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (driver) reset({ reason: '' });
  }, [driver, reset]);

  const remove = useMutation({
    mutationFn: (values: RemoveDriverValues) =>
      api.delete(`/v1/admin/drivers/${driver?.id ?? ''}`, { body: { reason: values.reason } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.drivers.all() });
      onOpenChange(false);
    },
  });

  return (
    <Dialog
      open={driver !== null}
      onOpenChange={onOpenChange}
      title="Remove driver"
      description={`${driver?.name ?? ''} will be taken off the platform.`}
      dismissible={!remove.isPending}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={remove.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="remove-driver"
            variant="danger"
            loading={remove.isPending}
            leadingIcon={<Trash2 className="size-4" />}
          >
            Remove driver
          </Button>
        </>
      }
    >
      <form
        id="remove-driver"
        noValidate
        onSubmit={(event) => void handleSubmit((values) => remove.mutate(values))(event)}
        className="space-y-5"
      >
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
          <div className="text-[13px] text-amber-900">
            <p className="font-medium">They disappear from every screen, but the record stays</p>
            <ul className="mt-2 space-y-1 text-[12px] text-amber-800">
              <li>
                The mobile <span className="numeric">{driver?.mobile}</span> becomes free to
                onboard again.
              </li>
              {driver?.vehicle ? (
                <li>
                  Vehicle{' '}
                  <span className="numeric">
                    {formatRegistration(driver.vehicle.registrationNumber)}
                  </span>{' '}
                  is marked removed, freeing the plate.
                </li>
              ) : null}
              <li>The audit trail keeps who removed them, when, and why.</li>
            </ul>
          </div>
        </div>

        <TextareaField
          label="Reason"
          required
          autoFocus
          placeholder="Duplicate record — the same driver was onboarded as KA 01 AB 1234."
          hint="Recorded against the driver. At least 10 characters."
          error={errors.reason?.message}
          {...register('reason')}
        />

        {remove.isError ? <FormError message={toDisplayMessage(remove.error)} /> : null}
      </form>
    </Dialog>
  );
}
