import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { TextField } from '@/shared/ui/form';
import { formatINR, formatKm } from '@/shared/format';
import {
  ZONE_PLAN_FIELDS,
  ZONE_RATES,
  rupeeValue,
  zoneBudgetTotal,
  type ZoneFieldKey,
} from '@/shared/schemas/campaign';

interface ZoneBudgetValues {
  zonePrimeKm: string;
  zoneSecondaryKm: string;
}

export function ZoneBudgetFields<T extends ZoneBudgetValues>({
  register,
  errors,
  values,
  description,
}: {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  values: Partial<ZoneBudgetValues>;
  description?: string;
}) {
  const total = zoneBudgetTotal(values);

  return (
    <div className="space-y-4">
      <div className="grid gap-5 sm:grid-cols-2">
        {ZONE_PLAN_FIELDS.map((zone) => {
          const km = rupeeValue(values[zone.key]);
          return (
            <TextField
              key={zone.key}
              label={`${zone.label} zone`}
              inputMode="numeric"
              placeholder="0"
              hint={
                km > 0
                  ? `${formatINR((km * zone.rate).toFixed(2))} at ₹${String(zone.rate)}/km`
                  : `Target kilometres. ₹${String(zone.rate)} per verified km.`
              }
              error={errors[zone.key as ZoneFieldKey]?.message}
              {...register(zone.key)}
            />
          );
        })}
      </div>

      <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-[12px] text-slate-600">
        <span className="font-medium text-slate-800">Network</span> is not planned here. Verified
        kilometres outside Prime and Secondary are billed at ₹{ZONE_RATES.network}/km and count
        against this campaign total.
      </p>

      <p className="text-[13px] text-slate-600">
        Planned spend{' '}
        <span className="numeric font-semibold text-slate-900">{formatINR(total)}</span>
        <span className="text-slate-400">
          {' '}
          · Prime × ₹{ZONE_RATES.prime} + Secondary × ₹{ZONE_RATES.secondary} · excluding GST ·
          minimum ₹10,000
          {description ? ` · ${description}` : ''}
        </span>
      </p>
    </div>
  );
}
