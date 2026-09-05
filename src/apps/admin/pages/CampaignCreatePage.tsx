import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Info, Wallet } from 'lucide-react';
import { api } from '@/shared/api/client';
import { toDisplayMessage } from '@/shared/api/errors';
import { useAdvertisers, type AdvertiserAccount } from '@/shared/api/hooks';
import { useAuth } from '@/shared/auth/useAuth';
import { adminPath } from '@/shared/auth/portals';
import { Page } from '@/shared/layout/Page';
import { Button, Card, CardBody, CardHeader, QueryBoundary } from '@/shared/ui';
import { DateField, FormError, SelectField, TextField } from '@/shared/ui/form';
import { compareMoney, formatDate, formatINR } from '@/shared/format';
import { platformTodayIso } from '@/shared/lib/civilDate';
import { VALIDATION_MODE } from '@/shared/lib/formConfig';
import { AdLocationsCard } from '@/shared/campaigns/AdLocationsCard';
import { ZoneBudgetFields } from '@/shared/campaigns/ZoneBudgetFields';
import {
  adjustedEndAfterStart,
  adminCampaignSchema,
  INSTRUCTION_CHANNELS,
  INSTRUCTION_HINTS,
  minCampaignEndDate,
  zoneBudgetTotal,
  type AdminCampaignFormValues,
} from '@/shared/schemas/campaign';

const CITIES = [{ value: 'Bengaluru', label: 'Bengaluru' }];
const VEHICLE_TYPES = [
  { value: 'CAB', label: 'Cab' },
  { value: 'AUTO', label: 'Auto' },
];

const today = () => platformTodayIso();

/**
 * AC-34: admin creates a campaign that an advertiser owns and pays for.
 *
 * Everything about the campaign itself uses the same schema as the advertiser's
 * own form, so the two routes cannot drift apart. What this route adds is the
 * accountability AC-34 asks for: which account owns the campaign, what the
 * advertiser actually asked for, and a budget that cannot exceed money they
 * have already funded.
 */
export default function AdminCampaignCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const advertisersQuery = useAdvertisers();

  return (
    <Page
      title="Create campaign for an advertiser"
      greeting="The advertiser owns and pays for this campaign, so it records who asked for it"
      controls={
        <Button
          variant="secondary"
          onClick={() => void navigate(adminPath('/campaigns'))}
          leadingIcon={<ArrowLeft className="size-4" />}
        >
          Back to campaigns
        </Button>
      }
    >
      <QueryBoundary query={advertisersQuery} errorTitle="Could not load advertiser accounts">
        {(data) => (
          <CampaignForm
            advertisers={data.items}
            adminName={user?.fullName ?? 'this admin'}
            onDone={() => void navigate(adminPath('/campaigns'))}
          />
        )}
      </QueryBoundary>
    </Page>
  );
}

function CampaignForm({
  advertisers,
  adminName,
  onDone,
}: {
  advertisers: AdvertiserAccount[];
  adminName: string;
  onDone: () => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<AdminCampaignFormValues>({
    resolver: zodResolver(adminCampaignSchema),
    ...VALIDATION_MODE,
    defaultValues: {
      advertiserId: '',
      name: '',
      brandName: '',
      city: 'Bengaluru',
      vehicleType: 'CAB',
      startDate: '',
      endDate: '',
      zonePrimeKm: '',
      zoneSecondaryKm: '',
      locations: [],
      zonePolygons: {},
      requestedVehicleIds: [],
      targetKm: '',
      instructionChannel: 'EMAIL',
      instructionReference: '',
      instructionDate: today(),
    },
  });

  const values = useWatch({ control });
  const selected = advertisers.find((a) => a.id === values.advertiserId);

  /*
   * AC-34.6: budget comes from the advertiser's prepaid wallet, and admin
   * cannot commit money the advertiser has not funded. Flagged here so the
   * problem is visible while the budget is being typed; the server rejects it
   * regardless, because only the server knows the balance at commit time.
   */
  const committed = zoneBudgetTotal(values);
  const overspends = Boolean(
    selected &&
      compareMoney(committed, '0') > 0 &&
      compareMoney(committed, selected.wallet.available) > 0,
  );

  const submit = useMutation({
    mutationFn: (draft: AdminCampaignFormValues) =>
      api.post<{ id: string }>('/v1/campaigns', draft),
    onSuccess: onDone,
  });

  const advertiserOptions = advertisers.map((a) => ({
    value: a.id,
    label: a.status === 'SUSPENDED' ? `${a.name} — suspended` : a.name,
    disabled: a.status === 'SUSPENDED',
  }));

  return (
    <form
      onSubmit={(event) => void handleSubmit((draft) => submit.mutate(draft))(event)}
      noValidate
      className="grid gap-5 lg:grid-cols-3"
    >
      <div className="space-y-5 lg:col-span-2">
        <Card>
          <CardHeader
            title="Advertiser"
            description="The account that will own this campaign, see it in their portal, and pay for it."
          />
          <CardBody className="space-y-4">
            <Controller
              control={control}
              name="advertiserId"
              render={({ field, fieldState }) => (
                <SelectField
                  label="Advertiser account"
                  required
                  placeholder="Select an advertiser…"
                  options={advertiserOptions}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  {...(fieldState.error?.message ? { error: fieldState.error.message } : {})}
                />
              )}
            />

            {selected ? (
              <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
                <Wallet className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-slate-600">
                    Available to commit{' '}
                    <span className="numeric font-semibold text-slate-900">
                      {formatINR(selected.wallet.available)}
                    </span>
                  </p>
                  <p className="numeric mt-1 text-[11px] text-slate-400">
                    Balance {formatINR(selected.wallet.balance)} · already committed{' '}
                    {formatINR(selected.wallet.committed)}
                  </p>
                </div>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Campaign details" />
          <CardBody className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Campaign name"
              required
              placeholder="Diwali Push"
              error={errors.name?.message}
              {...register('name')}
            />
            <TextField
              label="Brand name"
              required
              placeholder="CRED"
              error={errors.brandName?.message}
              {...register('brandName')}
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
                  hint="One city per campaign during the pilot."
                  {...(fieldState.error?.message ? { error: fieldState.error.message } : {})}
                />
              )}
            />
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
              name="startDate"
              render={({ field, fieldState }) => (
                <DateField
                  label="Start date"
                  required
                  value={field.value}
                  min={platformTodayIso()}
                  onChange={(next) => {
                    field.onChange(next);
                    const end = adjustedEndAfterStart(next, getValues('endDate'));
                    if (end !== getValues('endDate')) {
                      setValue('endDate', end, { shouldValidate: true, shouldTouch: true });
                    }
                  }}
                  onBlur={field.onBlur}
                  {...(fieldState.error?.message ? { error: fieldState.error.message } : {})}
                />
              )}
            />
            <Controller
              control={control}
              name="endDate"
              render={({ field, fieldState }) => (
                <DateField
                  label="End date"
                  required
                  value={field.value}
                  min={values.startDate ? minCampaignEndDate(values.startDate) : platformTodayIso()}
                  disabled={!values.startDate}
                  hint={
                    values.startDate
                      ? `Must be after the start date. Earliest ${formatDate(`${minCampaignEndDate(values.startDate)}T00:00:00Z`)}.`
                      : 'Pick a start date first.'
                  }
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  {...(fieldState.error?.message ? { error: fieldState.error.message } : {})}
                />
              )}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Target kilometres"
            description="Target kilometres for Prime and Secondary. Spend is kilometres × the fixed rate, committed from the advertiser's prepaid wallet."
          />
          <CardBody className="space-y-4">
            <ZoneBudgetFields register={register} errors={errors} values={values} />

            {overspends && selected ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                <span>
                  This budget is more than {selected.name} has available (
                  <span className="numeric">{formatINR(selected.wallet.available)}</span>). Ask
                  them to top up the wallet before creating the campaign.
                </span>
              </p>
            ) : null}
          </CardBody>
        </Card>

        <AdLocationsCard
          city={values.city || 'Bengaluru'}
          vehicleType={values.vehicleType ?? 'CAB'}
          locations={values.locations ?? []}
          polygons={values.zonePolygons}
          onLocationsChange={(next) =>
            setValue('locations', next, { shouldValidate: true, shouldTouch: true })
          }
          onPolygonsChange={(next) =>
            setValue('zonePolygons', next, { shouldValidate: true, shouldTouch: true })
          }
          endpoint="/v1/admin/vehicles/in-zones"
          selectedIds={values.requestedVehicleIds ?? []}
          onChange={(ids) =>
            setValue('requestedVehicleIds', ids, { shouldValidate: true, shouldTouch: true })
          }
          {...(errors.locations?.message ? { locationsError: errors.locations.message } : {})}
          {...(errors.requestedVehicleIds?.message
            ? { vehiclesError: errors.requestedVehicleIds.message }
            : {})}
        />

        <Card>
          <CardHeader
            title="Advertiser's instruction"
            description="What the advertiser asked for, so this spend can be traced back to their request."
          />
          <CardBody className="grid gap-5 sm:grid-cols-2">
            <Controller
              control={control}
              name="instructionChannel"
              render={({ field, fieldState }) => (
                <SelectField
                  label="How they asked"
                  required
                  options={INSTRUCTION_CHANNELS}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  {...(fieldState.error?.message ? { error: fieldState.error.message } : {})}
                />
              )}
            />
            <Controller
              control={control}
              name="instructionDate"
              render={({ field, fieldState }) => (
                <DateField
                  label="Date of instruction"
                  required
                  value={field.value}
                  max={today()}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  {...(fieldState.error?.message ? { error: fieldState.error.message } : {})}
                />
              )}
            />
            <TextField
              label="Reference"
              required
              containerClassName="sm:col-span-2"
              placeholder="Email: “Diwali campaign brief”, 14 Aug"
              hint={
                values.instructionChannel
                  ? INSTRUCTION_HINTS[values.instructionChannel]
                  : undefined
              }
              error={errors.instructionReference?.message}
              {...register('instructionReference')}
            />
          </CardBody>
        </Card>
      </div>

      <div className="space-y-4">
        {/* Clears the sticky header, which is about 82px tall. */}
        <Card className="sticky top-24">
          <CardHeader title="Before you create this" />
          <CardBody>
            <ul className="space-y-3 text-[13px] text-slate-600">
              {[
                `The campaign is owned by ${selected?.name ?? 'the advertiser'}, not by you, and appears in their portal.`,
                `It records that ${adminName} created it, and the instruction reference above.`,
                'The advertiser confirms the pricing and budget before it goes live.',
                'Another Super Admin approves it — you cannot approve a campaign you created.',
              ].map((line) => (
                <li key={line} className="flex gap-2.5">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-slate-300" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            {values.instructionDate ? (
              <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
                Instruction recorded as {formatDate(values.instructionDate)}.
              </p>
            ) : null}
          </CardBody>
        </Card>

        {submit.isError ? <FormError message={toDisplayMessage(submit.error)} /> : null}

        <Button type="submit" className="w-full" size="lg" loading={submit.isPending}>
          Create and send for confirmation
        </Button>

        <p className="text-center text-[11px] text-slate-400">
          Creating a campaign does not commit money until the advertiser confirms it.
        </p>
      </div>
    </form>
  );
}
