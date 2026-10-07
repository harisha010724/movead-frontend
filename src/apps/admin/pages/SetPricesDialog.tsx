import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { IndianRupee, Save } from 'lucide-react';
import { api } from '@/shared/api/client';
import { toDisplayMessage } from '@/shared/api/errors';
import type { AdvertiserListing } from '@/shared/api/hooks';
import { queryKeys } from '@/shared/api/queryKeys';
import { formatRate } from '@/shared/format';
import { VALIDATION_MODE } from '@/shared/lib/formConfig';
import type { AdvertiserRateCard } from '@/shared/types/domain';
import { Button, Dialog } from '@/shared/ui';
import { FormError, TextField } from '@/shared/ui/form';

const rateField = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,4})?$/, 'Enter a rate with up to 4 decimal places')
  .refine((value) => Number(value) <= 1000, 'Must be ₹1,000/km or less');

const schema = z.object({
  prime: rateField,
  secondary: rateField,
  network: rateField,
});

type Values = z.infer<typeof schema>;

function asInput(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : value;
}

function driverShare(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? (n * 0.6).toFixed(2) : '—';
}

/**
 * Sets the ₹/km this advertiser is billed at.
 *
 * Driver pay stays 60% of whatever is saved. Changing the card does not touch
 * campaigns already created — those keep the snapshot they were sold at.
 */
export function SetPricesDialog({
  advertiser,
  onOpenChange,
}: {
  advertiser: AdvertiserListing | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const card = advertiser?.rateCard;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    ...VALIDATION_MODE,
    defaultValues: { prime: '5', secondary: '2', network: '1' },
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (!card) return;
    reset({
      prime: asInput(card.prime),
      secondary: asInput(card.secondary),
      network: asInput(card.network),
    });
  }, [card, reset]);

  const prime = watch('prime');
  const secondary = watch('secondary');
  const network = watch('network');

  const save = useMutation({
    mutationFn: (values: Values) => {
      if (!advertiser) throw new Error('No advertiser');
      return api.put<AdvertiserRateCard>(`/v1/admin/advertisers/${advertiser.id}/rate-card`, values);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.advertisers.admin() }),
        advertiser
          ? queryClient.invalidateQueries({
              queryKey: queryKeys.advertisers.rateCard(advertiser.id),
            })
          : Promise.resolve(),
      ]);
      onOpenChange(false);
    },
  });

  return (
    <Dialog
      open={advertiser !== null}
      onOpenChange={onOpenChange}
      title="Set prices"
      description={
        advertiser
          ? `₹ per verified kilometre for ${advertiser.brandName}. New campaigns use these rates; existing ones keep what they were sold at.`
          : undefined
      }
      dismissible={!save.isPending}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={save.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="set-advertiser-prices"
            loading={save.isPending}
            leadingIcon={<Save className="size-4" />}
          >
            Save prices
          </Button>
        </>
      }
    >
      <form
        id="set-advertiser-prices"
        noValidate
        onSubmit={(event) => void handleSubmit((values) => save.mutate(values))(event)}
        className="space-y-5"
      >
        {card?.source === 'default' ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-[12px] text-slate-600">
            Using the platform default — Prime {formatRate(card.prime)}, Secondary{' '}
            {formatRate(card.secondary)}, Network {formatRate(card.network)}.
          </p>
        ) : card ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-[12px] text-slate-600">
            Custom card. Driver pay is 60% of each rate.
          </p>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-3">
          <TextField
            label="Prime ₹/km"
            required
            inputMode="decimal"
            autoFocus
            error={errors.prime?.message}
            hint={`Driver ${driverShare(prime)}/km`}
            {...register('prime')}
          />
          <TextField
            label="Secondary ₹/km"
            required
            inputMode="decimal"
            error={errors.secondary?.message}
            hint={`Driver ${driverShare(secondary)}/km`}
            {...register('secondary')}
          />
          <TextField
            label="Network ₹/km"
            required
            inputMode="decimal"
            error={errors.network?.message}
            hint={`Driver ${driverShare(network)}/km`}
            {...register('network')}
          />
        </div>

        <p className="flex items-start gap-2 text-[12px] text-slate-500">
          <IndianRupee className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Advertisers see these rates when they plan a campaign. They cannot change them.
        </p>

        {save.isError ? <FormError message={toDisplayMessage(save.error)} /> : null}
      </form>
    </Dialog>
  );
}
