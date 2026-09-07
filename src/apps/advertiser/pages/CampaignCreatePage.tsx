import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calculator } from 'lucide-react';
import { api } from '@/shared/api/client';
import { useCampaign } from '@/shared/api/hooks';
import { queryKeys } from '@/shared/api/queryKeys';
import { toDisplayMessage } from '@/shared/api/errors';
import { env } from '@/shared/config/env';
import { Page } from '@/shared/layout/Page';
import { Button, Card, CardBody, CardHeader, QueryBoundary } from '@/shared/ui';
import { DateField, FormError, SelectField, TextField } from '@/shared/ui/form';
import { formatDate, formatINR, formatKm } from '@/shared/format';
import { VALIDATION_MODE } from '@/shared/lib/formConfig';
import type { Campaign, Money } from '@/shared/types/domain';
import { AdLocationsCard } from '@/shared/campaigns/AdLocationsCard';
import { CreativeUpload } from '@/shared/campaigns/CreativeUpload';
import { creativeKindFromName } from '@/shared/campaigns/creativeFile';
import { ZoneBudgetFields } from '@/shared/campaigns/ZoneBudgetFields';
import { platformTodayIso } from '@/shared/lib/civilDate';
import {
  adjustedEndAfterStart,
  campaignSchema,
  canEditCampaign,
  minCampaignEndDate,
  previewZoneEstimate,
  rupeeValue,
  toCampaignFormValues,
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

const CITIES = [{ value: 'Bengaluru', label: 'Bengaluru' }];
const VEHICLE_TYPES = [
  { value: 'CAB', label: 'Cab' },
  { value: 'AUTO', label: 'Auto' },
];

const EMPTY_DRAFT: CampaignFormValues = {
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
  const today = platformTodayIso();
  const startMin =
    campaign && campaign.startDate.slice(0, 10) < today ? campaign.startDate.slice(0, 10) : today;

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    ...VALIDATION_MODE,
    defaultValues: campaign ? toCampaignFormValues(campaign) : EMPTY_DRAFT,
  });

  /*
   * `useWatch` types every field as deep-partial. `defaultValues` above seeds
   * all of them and only `setValue` writes the map fields, so where a whole
   * location or polygon is handed on it is asserted back to its real shape.
   */
  const values = useWatch({ control });
  const preview = previewZoneEstimate(values);
  const hasZoneAmount = rupeeValue(values.zonePrimeKm) + rupeeValue(values.zoneSecondaryKm) > 0;

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
        onSubmit={(event) => void handleSubmit((draft) => submit.mutate(draft))(event)}
        noValidate
        className="grid gap-5 lg:grid-cols-3"
      >
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="Campaign details" />
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
                    options={VEHICLE_TYPES}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    {...(fieldState.error?.message
                      ? { error: fieldState.error.message }
                      : {})}
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
              description="Enter how many kilometres you want in Prime and Secondary. Spend is kilometres × the fixed rate."
            />
            <CardBody>
              <ZoneBudgetFields register={register} errors={errors} values={values} />
            </CardBody>
          </Card>

          <AdLocationsCard
            city={values.city || 'Bengaluru'}
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
        </div>

        <div className="space-y-4">
          <Card className="sticky top-24">
            <CardHeader title="Estimated reach" />
            <CardBody>
              {hasZoneAmount ? (
                <dl className="space-y-3 text-[13px]">
                  {preview.rows.map((row) => (
                    <div key={row.key} className="flex justify-between gap-3">
                      <dt className="text-slate-500">
                        {row.label}
                        <span className="block text-[11px] text-slate-400">₹{row.rate}/km</span>
                      </dt>
                      <dd className="text-right">
                        <span className="numeric block font-medium text-slate-900">
                          {formatINR(row.amount.toFixed(2))}
                        </span>
                        <span className="numeric block text-[11px] text-slate-500">
                          {formatKm(row.km)}
                        </span>
                      </dd>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-slate-100 pt-3">
                    <dt className="text-slate-500">Estimated distance</dt>
                    <dd className="numeric font-medium text-slate-900">{formatKm(preview.totalKm)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Vehicles needed</dt>
                    <dd className="numeric font-medium text-slate-900">
                      {preview.vehicles || '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-3">
                    <dt className="font-medium text-slate-700">Estimated spend</dt>
                    <dd className="numeric font-semibold text-slate-900">
                      {formatINR(preview.totalAmount.toFixed(2))}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-[13px] text-slate-500">
                  Enter Prime and Secondary kilometres to see planned spend at ₹5/km and ₹2/km.
                  Network (₹1/km) is only billed if a driver leaves those zones.
                </p>
              )}

              {estimate.isError ? (
                <FormError message={toDisplayMessage(estimate.error)} className="mt-3" />
              ) : null}

              <Button
                type="button"
                variant="secondary"
                className="mt-4 w-full"
                loading={estimate.isPending}
                leadingIcon={<Calculator className="size-4" />}
                onClick={() => estimate.mutate(getValues())}
                disabled={!canEstimate}
              >
                Calculate estimate
              </Button>

              <p className="mt-3 text-[11px] text-slate-400">
                An estimate is not a commitment. You are charged only for verified kilometres
                actually driven.
              </p>
            </CardBody>
          </Card>

          {submit.isError ? <FormError message={toDisplayMessage(submit.error)} /> : null}

          <Button type="submit" className="w-full" size="lg" loading={submit.isPending}>
            {editing ? 'Save changes' : 'Submit for review'}
          </Button>
        </div>
      </form>
    </Page>
  );
}
