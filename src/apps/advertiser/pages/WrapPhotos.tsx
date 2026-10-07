import { ImageOff } from 'lucide-react';

import { useCampaignBrandingProofs } from '@/shared/api/hooks';
import { env } from '@/shared/config/env';
import { formatRegistration } from '@/shared/format';
import type { BrandingAngle, BrandingProof } from '@/shared/types/domain';
import { Card, CardHeader, EmptyState, QueryBoundary } from '@/shared/ui';

const ANGLE_LABEL: Record<BrandingAngle, string> = {
  FRONT: 'Front',
  REAR: 'Rear',
  LEFT: 'Left side',
  RIGHT: 'Right side',
  AD_CLOSEUP: 'Advertisement close-up',
};

/**
 * GPS-stamped wrap photos the driver took. There is no ops approval step —
 * sending them publishes them here.
 */
export function WrapPhotos({ campaignId }: { campaignId: string }) {
  const query = useCampaignBrandingProofs(campaignId);

  return (
    <Card>
      <CardHeader
        title="Wrap photos"
        description="Photographs of the advertisement on each vehicle, with the location and time they were taken."
      />
      <QueryBoundary query={query} errorTitle="Could not load wrap photos">
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState
              icon={ImageOff}
              title="No wrap photos yet"
              description="They appear here once a driver photographs the advertisement on their vehicle."
            />
          ) : (
            <div className="grid gap-8 px-5 pb-5">
              {data.items.map((proof) => (
                <ProofSet key={proof.id} campaignId={campaignId} proof={proof} />
              ))}
            </div>
          )
        }
      </QueryBoundary>
    </Card>
  );
}

function ProofSet({ campaignId, proof }: { campaignId: string; proof: BrandingProof }) {
  return (
    <section>
      <div className="mb-3">
        <h3 className="text-[13px] font-semibold text-slate-900">
          {formatRegistration(proof.registrationNumber)}
        </h3>
        <p className="text-[12px] text-slate-500">
          {proof.driverName}
          {proof.submittedAt ? ` · ${formatWhen(proof.submittedAt)}` : ''}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {proof.photos.map((photo) => (
          <figure key={photo.id} className="overflow-hidden rounded-xl border border-slate-200">
            <img
              src={`${env.apiUrl}/v1/campaigns/${campaignId}/branding-proof-photos/${photo.id}`}
              alt={`${ANGLE_LABEL[photo.angle]} of ${proof.registrationNumber}`}
              className="h-40 w-full bg-slate-100 object-cover"
            />
            <figcaption className="px-3 py-2 text-[12px] text-slate-600">
              <span className="font-medium">{ANGLE_LABEL[photo.angle]}</span>
              <span className="mt-0.5 block text-slate-500">
                {photo.lat.toFixed(5)}, {photo.lon.toFixed(5)} · {formatWhen(photo.capturedAt)}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
