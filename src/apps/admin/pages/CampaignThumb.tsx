import { useState } from 'react';
import { env } from '@/shared/config/env';
import { cn } from '@/shared/lib/cn';
import type { AdminCampaign } from '@/shared/types/domain';

/** Static class names, so Tailwind can see every one of them. */
const TILES = [
  'from-brand-500 to-indigo-800',
  'from-fuchsia-500 to-purple-800',
  'from-rose-500 to-red-800',
  'from-emerald-500 to-teal-800',
  'from-sky-500 to-blue-800',
  'from-amber-500 to-orange-800',
  'from-slate-600 to-slate-900',
] as const;

function tileFor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TILES[hash % TILES.length] ?? TILES[0];
}

/** Two short lines from the campaign name, the way a poster would set it. */
function captionLines(name: string): [string, string] {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = (words[0] ?? '').slice(0, 10);
  return [first, words.slice(1, 3).join(' ').slice(0, 12)];
}

function isImageCreative(campaign: AdminCampaign): boolean {
  if (!campaign.creativeKey) return false;
  const name = (campaign.creativeFileName ?? campaign.creativeKey).toLowerCase();
  return !name.endsWith('.pdf');
}

/**
 * The campaign's artwork as a small thumbnail.
 *
 * The creative is behind the admin session, and a PDF cannot be drawn in an
 * <img>, so a thumbnail can fail to load. A tile carrying the campaign's name
 * stands in whenever that happens, rather than leaving a broken-image icon in
 * the middle of a table.
 */
export function CampaignThumb({
  campaign,
  className,
}: {
  campaign: AdminCampaign;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [top, bottom] = captionLines(campaign.name);

  if (isImageCreative(campaign) && !failed) {
    return (
      <img
        src={`${env.apiUrl}/v1/admin/campaigns/${campaign.id}/creative`}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn('h-10 w-14 shrink-0 rounded-md bg-slate-100 object-cover', className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        'flex h-10 w-14 shrink-0 flex-col items-center justify-center rounded-md bg-gradient-to-br px-1 text-center',
        'text-[8px] leading-[1.15] font-bold tracking-wide text-white uppercase',
        tileFor(campaign.name),
        className,
      )}
    >
      <span className="max-w-full truncate">{top}</span>
      {bottom ? <span className="max-w-full truncate opacity-90">{bottom}</span> : null}
    </span>
  );
}
