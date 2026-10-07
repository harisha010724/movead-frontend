import type { FieldErrors, Path, UseFormRegister } from 'react-hook-form';
import { TextField } from '@/shared/ui/form';
import { formatINR } from '@/shared/format';
import {
  DEFAULT_ZONE_RATES,
  rupeeValue,
  zoneBudgetTotal,
  zonePlanFields,
  type ZoneRates,
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
  rates = DEFAULT_ZONE_RATES,
}: {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  values: Partial<ZoneBudgetValues>;
  description?: string;
  rates?: ZoneRates;
}) {
  const total = zoneBudgetTotal(values, rates);
  const fields = zonePlanFields(rates);

  /*
   * The constraint guarantees `T` carries both zone fields, but RHF's error and
   * path types are resolved against the bare type parameter and cannot see
   * through it. Narrowing to the two keys this component owns is what the
   * constraint already promises.
   */
  const zoneErrors = errors as FieldErrors<ZoneBudgetValues>;

  return (
    <div className="space-y-4">
      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map((zone) => {
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
              error={zoneErrors[zone.key]?.message}
              {...register(zone.key as Path<T>)}
            />
          );
        })}
      </div>

      <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-[12px] text-slate-600">
        <span className="font-medium text-slate-800">Network</span> is not planned here. Verified
        kilometres outside Prime and Secondary are billed at ₹{rates.network}/km and count
        against this campaign total.
      </p>

      <p className="text-[13px] text-slate-600">
        Planned spend{' '}
        <span className="numeric font-semibold text-slate-900">{formatINR(total)}</span>
        <span className="text-slate-400">
          {' '}
          · Prime × ₹{rates.prime} + Secondary × ₹{rates.secondary} · excluding GST
          {description ? ` · ${description}` : ''}
        </span>
      </p>
    </div>
  );
}
