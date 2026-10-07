import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, Info, Wallet } from 'lucide-react';
import { api } from '@/shared/api/client';
import { toDisplayMessage } from '@/shared/api/errors';
import { useAdminAdvertiserRateCard, useAdvertisers, type AdvertiserAccount } from '@/shared/api/hooks';
import { useAuth } from '@/shared/auth/useAuth';
import { adminPath } from '@/shared/auth/portals';
import { Page } from '@/shared/layout/Page';
import { Button, Card, CardBody, CardHeader, QueryBoundary } from '@/shared/ui';
import { ADMIN_CAMPAIGN_STEPS, ADMIN_STEP_FIELDS } from '@/shared/campaigns/campaignSteps';
import { CampaignDraftPreview } from '@/shared/campaigns/CampaignDraftPreview';
import { CampaignWizardShell } from '@/shared/campaigns/CampaignWizardShell';
import { DateField, FormError, SelectField, TextField } from '@/shared/ui/form';
import { compareMoney, formatDate, formatINR } from '@/shared/format';
import { platformTodayIso } from '@/shared/lib/civilDate';
import { VALIDATION_MODE } from '@/shared/lib/formConfig';
import { AdLocationsCard } from '@/shared/campaigns/AdLocationsCard';
import {
  VEHICLE_TYPE_OPTIONS,
  adDimensionsFor,
  defaultAdDimension,
} from '@/shared/campaigns/vehicleCatalog';
import { ZoneBudgetFields } from '@/shared/campaigns/ZoneBudgetFields';
import { CityAutocomplete } from '@/shared/maps/CityAutocomplete';
import {
  adjustedEndAfterStart,
  adminCampaignSchema,
  INSTRUCTION_CHANNELS,
  INSTRUCTION_HINTS,
  minCampaignEndDate,
  zoneBudgetTotal,
  zoneRatesFromCard,
  type AdminCampaignFormValues,
  type CampaignLocation,
  type ZonePolygons,
} from '@/shared/schemas/campaign';

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
    trigger,
    formState: { errors },
  } = useForm<AdminCampaignFormValues>({
    resolver: zodResolver(adminCampaignSchema),
    ...VALIDATION_MODE,
    defaultValues: {
      advertiserId: '',
      name: '',
      brandName: '',
      city: '',
      vehicleType: 'CAB',
      adDimension: defaultAdDimension('CAB'),
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

  /*
   * `useWatch` types every field as deep-partial. `defaultValues` above seeds
   * all of them and only `setValue` writes the map fields, so where a whole
   * location or polygon is handed on it is asserted back to its real shape.
   */
  const values = useWatch({ control });
  const [step, setStep] = useState(0);
  const [farthest, setFarthest] = useState(0);
  const currentStep = ADMIN_CAMPAIGN_STEPS[step] ?? ADMIN_CAMPAIGN_STEPS[0];
  const lastStep = step === ADMIN_CAMPAIGN_STEPS.length - 1;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  function goTo(index: number) {
    if (index >= 0 && index <= farthest) setStep(index);
  }

  async function goNext() {
    const fields = ADMIN_STEP_FIELDS[currentStep.id];
    if (fields.length > 0) {
      const ok = await trigger(fields);
      if (!ok) return;
    }
    const next = Math.min(step + 1, ADMIN_CAMPAIGN_STEPS.length - 1);
    setStep(next);
    setFarthest((reached) => Math.max(reached, next));
  }

  const selected = advertisers.find((a) => a.id === values.advertiserId);
  const rateCardQuery = useAdminAdvertiserRateCard(values.advertiserId || undefined);
  const rates = zoneRatesFromCard(rateCardQuery.data);
  const adSizeOptions = adDimensionsFor(values.vehicleType || 'CAB').map((row) => ({
    value: row.value,
    label: `${row.label} · ${row.hint}`,
  }));

  /*
   * AC-34.6: budget comes from the advertiser's prepaid wallet, and admin
   * cannot commit money the advertiser has not funded. Flagged here so the
   * problem is visible while the budget is being typed; the server rejects it
   * regardless, because only the server knows the balance at commit time.
   */
  const committed = zoneBudgetTotal(values, rates);
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
      onSubmit={(event) => {
        if (!lastStep) {
          event.preventDefault();
          void goNext();
          return;
        }
        void handleSubmit((draft) => submit.mutate(draft))(event);
      }}
      noValidate
    >
      <CampaignWizardShell
        steps={ADMIN_CAMPAIGN_STEPS}
        current={step}
        farthest={farthest}
        onSelect={goTo}
        preview={
          <CampaignDraftPreview
            farthestStepId={ADMIN_CAMPAIGN_STEPS[farthest]?.id}
            rates={rates}
            values={{
              name: values.name,
              brandName: values.brandName,
              city: values.city,
              vehicleType: values.vehicleType,
              adDimension: values.adDimension,
              startDate: values.startDate,
              endDate: values.endDate,
              zonePrimeKm: values.zonePrimeKm,
              zoneSecondaryKm: values.zoneSecondaryKm,
              locations: values.locations as CampaignLocation[] | undefined,
              zonePolygons: values.zonePolygons as ZonePolygons | undefined,
              vehiclesCount: values.requestedVehicleIds?.length ?? 0,
              advertiserName: selected?.name,
            }}
          />
        }
        actions={
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {step > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  leadingIcon={<ArrowLeft className="size-4" />}
                  onClick={() => goTo(step - 1)}
                >
                  Back
                </Button>
              ) : (
                <span />
              )}
              <div className="flex min-w-0 flex-1 flex-col items-end gap-2 sm:flex-row sm:justify-end">
                {submit.isError ? <FormError message={toDisplayMessage(submit.error)} /> : null}
                {lastStep ? (
                  <Button type="submit" size="lg" loading={submit.isPending}>
                    Create and send for confirmation
                  </Button>
                ) : (
                  <Button type="submit" size="lg">
                    Continue
                    <ArrowRight className="size-4" />
                  </Button>
                )}
              </div>
            </div>
            {lastStep ? (
              <p className="text-right text-[11px] text-slate-400">
                Creating a campaign does not commit money until the advertiser confirms it.
              </p>
            ) : null}
          </div>
        }
      >
        <>
          {currentStep.id === 'advertiser' ? (
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
          ) : null}

          {currentStep.id === 'details' ? (
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
              </CardBody>
            </Card>
          ) : null}

          {currentStep.id === 'vehicle' ? (
            <Card>
              <CardHeader
                title="Vehicle wrap"
                description="The wrap preview on the right updates as you change type and size."
              />
              <CardBody className="grid gap-5 sm:grid-cols-2">
                <Controller
                  control={control}
                  name="city"
                  render={({ field, fieldState }) => (
                    <CityAutocomplete
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      required
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
                      options={VEHICLE_TYPE_OPTIONS}
                      value={field.value}
                      onValueChange={(next) => {
                        field.onChange(next);
                        setValue('adDimension', defaultAdDimension(next), { shouldValidate: true });
                      }}
                      onBlur={field.onBlur}
                      hint="Autos, cabs, buses, trucks and tempos."
                      {...(fieldState.error?.message ? { error: fieldState.error.message } : {})}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="adDimension"
                  render={({ field, fieldState }) => (
                    <SelectField
                      label="Ad size"
                      required
                      containerClassName="sm:col-span-2"
                      options={adSizeOptions}
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      hint="Wrap coverage for this vehicle. Operations still cuts to the make."
                      {...(fieldState.error?.message ? { error: fieldState.error.message } : {})}
                    />
                  )}
                />
              </CardBody>
            </Card>
          ) : null}

          {currentStep.id === 'plan' ? (
            <>
              <Card>
                <CardHeader title="Schedule" />
                <CardBody className="grid gap-5 sm:grid-cols-2">
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
                        min={
                          values.startDate ? minCampaignEndDate(values.startDate) : platformTodayIso()
                        }
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
                  description="Target kilometres for Prime and Secondary. Spend is kilometres × this advertiser's rate, committed from their prepaid wallet."
                />
                <CardBody className="space-y-4">
                  <ZoneBudgetFields
                    register={register}
                    errors={errors}
                    values={values}
                    rates={rates}
                  />

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
            </>
          ) : null}

          {currentStep.id === 'locations' ? (
            <AdLocationsCard
              city={values.city || ''}
              vehicleType={values.vehicleType ?? 'CAB'}
              locations={(values.locations ?? []) as CampaignLocation[]}
              polygons={values.zonePolygons as ZonePolygons | undefined}
              onLocationsChange={(next) =>
                setValue('locations', next, { shouldValidate: true, shouldTouch: true })
              }
              onPolygonsChange={(next) =>
                setValue('zonePolygons', next, { shouldValidate: true, shouldTouch: true })
              }
              endpoint="/v1/admin/vehicles/in-zones"
              rates={rates}
              selectedIds={values.requestedVehicleIds ?? []}
              onChange={(ids) =>
                setValue('requestedVehicleIds', ids, { shouldValidate: true, shouldTouch: true })
              }
              {...(errors.locations?.message ? { locationsError: errors.locations.message } : {})}
              {...(errors.requestedVehicleIds?.message
                ? { vehiclesError: errors.requestedVehicleIds.message }
                : {})}
            />
          ) : null}

          {currentStep.id === 'instruction' ? (
            <>
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
            <Card>
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
            </>
          ) : null}
        </>
      </CampaignWizardShell>
    </form>
  );
}
