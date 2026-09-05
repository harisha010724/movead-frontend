/** Drawn / pinned zones only. Network is leftover geography, not drawn. */
export type ZoneTier = 'prime' | 'secondary';

export interface CampaignLocation {
  id: string;
  placeId: string;
  label: string;
  lat: number;
  lng: number;
  tier: ZoneTier;
}

export interface ZonePath {
  path: { lat: number; lng: number }[];
}

export type ZonePolygons = Partial<Record<ZoneTier, ZonePath>>;
