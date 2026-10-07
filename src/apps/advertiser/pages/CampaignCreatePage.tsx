import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Calculator } from 'lucide-react';
import { api } from '@/shared/api/client';
import { useCampaign, useMyRateCard } from '@/shared/api/hooks';
import { queryKeys } from '@/shared/api/queryKeys';
import { toDisplayMessage } from '@/shared/api/errors';
import { env } from '@/shared/config/env';
import { Page } from '@/shared/layout/Page';
import { Button, Card, CardBody, CardHeader, QueryBoundary } from '@/shared/ui';
import {
  ADVERTISER_CAMPAIGN_STEPS,
  ADVERTISER_STEP_FIELDS,
} from '@/shared/campaigns/campaignSteps';
import { DateField, FormError, SelectField, TextField } from '@/shared/ui/form';
import { formatDate } from '@/shared/format';
import { VALIDATION_MODE } from '@/shared/lib/formConfig';
import type { Campaign, Money } from '@/shared/types/domain';
import { AdLocationsCard } from '@/shared/campaigns/AdLocationsCard';
import { CreativeUpload } from '@/shared/campaigns/CreativeUpload';
import { creativeKindFromName } from '@/shared/campaigns/creativeFile';
import { CampaignDraftPreview } from '@/shared/campaigns/CampaignDraftPreview';
import { CampaignWizardShell } from '@/shared/campaigns/CampaignWizardShell';
import {
  VEHICLE_TYPE_OPTIONS,
  adDimensionsFor,
  defaultAdDimension,
} from '@/shared/campaigns/vehicleCatalog';
import { ZoneBudgetFields } from '@/shared/campaigns/ZoneBudgetFields';
import { CityAutocomplete } from '@/shared/maps/CityAutocomplete';
import { platformTodayIso } from '@/shared/lib/civilDate';
import {
  adjustedEndAfterStart,
  campaignSchema,
  canEditCampaign,
  minCampaignEndDate,
  rupeeValue,
  toCampaignFormValues,
  zoneRatesFromCard,
  type CampaignFormValues,
  type CampaignLocation,
  type ZonePolygons,
} from '@/shared/schemas/campaign';

interface Estimate {
  budget: Money;
  estimatedKm: { prime: number; secondary: number; network: number };
  estimatedSpend: { prime: Money; secondary: Money; network: Money; total: Money };
  estimatedVehicles: number;
  estimatedDays: number;
}

const EMPTY_DRAFT: CampaignFormValues = {
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
};

export default function CampaignCreatePage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const query = useCampaign(campaignId);

  if (!campaignId) {
    return <CampaignDraftForm />;
  }

  return (
    <QueryBoundary query={query} errorTitle="Could not load this campaign">
      {(campaign) =>
        canEditCampaign(campaign.status) ? (
          <CampaignDraftForm campaign={campaign} />
        ) : (
          <Page
            title="Edit campaign"
            greeting="This campaign has already been approved, so the brief is locked"
            controls={
              <Button
                variant="secondary"
                onClick={() => void navigate('/campaigns')}
                leadingIcon={<ArrowLeft className="size-4" />}
              >
                Back to campaigns
              </Button>
            }
          >
            <p className="text-[13px] text-slate-500">
              After approval, vehicles and spend are in motion. Ask operations if something still
              needs to change.
            </p>
          </Page>
        )
      }
    </QueryBoundary>
  );
}

function CampaignDraftForm({ campaign }: { campaign?: Campaign }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [creative, setCreative] = useState<File | null>(null);
  const editing = Boolean(campaign);
  const myRates = useMyRateCard();
  const rates = zoneRatesFromCard(campaign?.rateCard ?? myRates.data);
  const today = platformTodayIso();
  const startMin =
    campaign && campaign.startDate.slice(0, 10) < today ? campaign.startDate.slice(0, 10) : today;

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    ...VALIDATION_MODE,
    defaultValues: campaign ? toCampaignFormValues(campaign) : EMPTY_DRAFT,
  });

  const [step, setStep] = useState(0);
  const [farthest, setFarthest] = useState(editing ? ADVERTISER_CAMPAIGN_STEPS.length - 1 : 0);
  const currentStep = ADVERTISER_CAMPAIGN_STEPS[step] ?? ADVERTISER_CAMPAIGN_STEPS[0];
  const lastStep = step === ADVERTISER_CAMPAIGN_STEPS.length - 1;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  function goTo(index: number) {
    if (index >= 0 && index <= farthest) setStep(index);
  }

  async function goNext() {
    const fields = ADVERTISER_STEP_FIELDS[currentStep.id];
    if (fields.length > 0) {
      const ok = await trigger(fields);
      if (!ok) return;
    }
    const next = Math.min(step + 1, ADVERTISER_CAMPAIGN_STEPS.length - 1);
    setStep(next);
    setFarthest((reached) => Math.max(reached, next));
  }

  /*
   * `useWatch` types every field as deep-partial. `defaultValues` above seeds
   * all of them and only `setValue` writes the map fields, so where a whole
   * location or polygon is handed on it is asserted back to its real shape.
   */
  const values = useWatch({ control });
  const hasZoneAmount = rupeeValue(values.zonePrimeKm) + rupeeValue(values.zoneSecondaryKm) > 0;
  const adSizeOptions = adDimensionsFor(values.vehicleType || 'CAB').map((row) => ({
    value: row.value,
    label: `${row.label} · ${row.hint}`,
  }));

  const estimate = useMutation({
    mutationFn: (draft: CampaignFormValues) =>
      api.post<Estimate>('/v1/campaigns/estimate', {
        city: draft.city,
        vehicleType: draft.vehicleType,
        startDate: draft.startDate,
        endDate: draft.endDate,
        zonePrimeKm: draft.zonePrimeKm,
        zoneSecondaryKm: draft.zoneSecondaryKm,
      }),
  });

  const submit = useMutation({
    mutationFn: async (draft: CampaignFormValues) => {
      let creativeKey: string | undefined;
      if (creative) {
        const form = new FormData();
        form.append('file', creative);
        const uploaded = await api.upload<{ storageKey: string }>('/v1/campaigns/creatives', form);
        creativeKey = uploaded.storageKey;
      }

      const body = {
        name: draft.name,
        brandName: draft.brandName,
        city: draft.city,
        vehicleType: draft.vehicleType,
        adDimension: draft.adDimension,
        startDate: draft.startDate,
        endDate: draft.endDate,
        zonePrimeKm: draft.zonePrimeKm,
        zoneSecondaryKm: draft.zoneSecondaryKm,
        locations: draft.locations,
        zonePolygons: draft.zonePolygons,
        requestedVehicleIds: draft.requestedVehicleIds,
        targetKm: draft.targetKm || undefined,
        creativeKey,
      };

      return campaign
        ? api.patch<{ id: string }>(`/v1/campaigns/${campaign.id}`, body)
        : api.post<{ id: string }>('/v1/campaigns', body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all() });
      if (campaign) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaign.id) });
      }
      void navigate('/campaigns');
    },
  });

  const canEstimate = Boolean(
    values.city && hasZoneAmount && values.startDate && values.endDate && !errors.endDate,
  );

  const existingCreative = campaign?.creativeKey
    ? {
        name: campaign.creativeFileName ?? campaign.creativeKey.split('/').pop() ?? 'Creative',
        href: `${env.apiUrl}/v1/campaigns/creatives/${campaign.creativeKey}`,
        kind: creativeKindFromName(campaign.creativeKey) ?? 'png',
      }
    : null;

  return (
    <Page
      title={editing ? 'Edit campaign' : 'New campaign'}
      greeting={
        editing
          ? 'Changes go back to MoveAd operations for review'
          : 'Campaigns are reviewed by MoveAd operations before vehicles are assigned'
      }
      controls={
        editing ? (
          <Button
            variant="secondary"
            onClick={() => void navigate('/campaigns')}
            leadingIcon={<ArrowLeft className="size-4" />}
          >
            Back to campaigns
          </Button>
        ) : undefined
      }
    >
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
          steps={ADVERTISER_CAMPAIGN_STEPS}
          current={step}
          farthest={farthest}
          onSelect={goTo}
          preview={
            <CampaignDraftPreview
              farthestStepId={ADVERTISER_CAMPAIGN_STEPS[farthest]?.id}
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
              }}
            />
          }
          actions={
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
                    {editing ? 'Save changes' : 'Submit for review'}
                  </Button>
                ) : (
                  <Button type="submit" size="lg">
                    Continue
                    <ArrowRight className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          }
        >
          <>
            {currentStep.id === 'details' ? (
              <Card>
                <CardHeader
                  title="Campaign details"
                  description="This is how the campaign appears to operations and on reports."
                />
                <CardBody className="grid gap-5 sm:grid-cols-2">
                  <TextField
                    label="Campaign name"
                    required
                    placeholder="ABC Summer Sale"
                    error={errors.name?.message}
                    {...register('name')}
                  />
                  <TextField
                    label="Brand name"
                    required
                    placeholder="ABC Retail"
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
                        {...(fieldState.error?.message
                          ? { error: fieldState.error.message }
                          : {})}
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
                          setValue('adDimension', defaultAdDimension(next), {
                            shouldValidate: true,
                          });
                        }}
                        onBlur={field.onBlur}
                        hint="Autos, cabs, buses, trucks and tempos."
                        {...(fieldState.error?.message
                          ? { error: fieldState.error.message }
                          : {})}
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
                        {...(fieldState.error?.message
                          ? { error: fieldState.error.message }
                          : {})}
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
                          min={startMin}
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
                          min={values.startDate ? minCampaignEndDate(values.startDate) : startMin}
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
                    description="Enter how many kilometres you want in Prime and Secondary. Spend is kilometres × your rate for each zone."
                  />
                  <CardBody className="space-y-4">
                    <ZoneBudgetFields
                      register={register}
                      errors={errors}
                      values={values}
                      rates={rates}
                    />
                    {estimate.isError ? (
                      <FormError message={toDisplayMessage(estimate.error)} />
                    ) : null}
                    <Button
                      type="button"
                      variant="secondary"
                      loading={estimate.isPending}
                      leadingIcon={<Calculator className="size-4" />}
                      onClick={() => estimate.mutate(getValues())}
                      disabled={!canEstimate}
                    >
                      Calculate estimate
                    </Button>
                    <p className="text-[11px] text-slate-400">
                      Planned spend also shows in the preview. You are charged only for verified
                      kilometres actually driven.
                    </p>
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
                endpoint="/v1/campaigns/available-vehicles"
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

            {currentStep.id === 'creative' ? (
              <Card>
                <CardHeader
                  title="Creative"
                  description="Artwork is reviewed before installation is scheduled."
                />
                <CardBody>
                  <CreativeUpload
                    file={creative}
                    existing={existingCreative}
                    onChange={setCreative}
                  />
                </CardBody>
              </Card>
            ) : null}
          </>
        </CampaignWizardShell>
      </form>
    </Page>
  );
}
