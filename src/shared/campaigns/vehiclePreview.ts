import type { VehicleType } from './vehicleCatalog';

/**
 * Body panels a wrap can cover. The preview lights these; everything else
 * stays the unpainted body so the advertiser can see what they are buying.
 */
export type WrapPanel = 'hood' | 'doors' | 'side' | 'rear' | 'rearWindow' | 'quarter' | 'cabin';

const PANELS: Record<VehicleType, Record<string, WrapPanel[]>> = {
  AUTO: {
    HOOD: ['hood'],
    REAR_HALF: ['rear'],
    REAR_FULL: ['rear'],
    SIDE_PANEL: ['side'],
    FULL_WRAP: ['hood', 'side', 'rear'],
  },
  CAB: {
    WRAP_180: ['doors'],
    WRAP_270: ['doors', 'quarter', 'rear'],
    WRAP_360: ['hood', 'doors', 'quarter', 'rear'],
    REAR_WINDOW: ['rearWindow'],
    HOOD: ['hood'],
  },
  BUS: {
    SIDE_PANEL: ['side'],
    BACK_PANEL: ['rear'],
    FULL_WRAP: ['hood', 'side', 'rear'],
  },
  TRUCK: {
    SIDE_PANEL: ['side'],
    REAR_DOOR: ['rear'],
    FULL_WRAP: ['cabin', 'side', 'rear'],
  },
  TEMPO: {
    SIDE_PANEL: ['side'],
    REAR_DOOR: ['rear'],
    FULL_WRAP: ['cabin', 'side', 'rear'],
  },
};

export function wrapPanelsFor(type: string, dimension: string): WrapPanel[] {
  const kind = (type in PANELS ? type : 'CAB') as VehicleType;
  return PANELS[kind][dimension] ?? [];
}

export function panelIsLit(type: string, dimension: string, panel: WrapPanel): boolean {
  return wrapPanelsFor(type, dimension).includes(panel);
}

export type VehicleView = 'front' | 'side' | 'rear';

export const VEHICLE_VIEWS: { id: VehicleView; label: string }[] = [
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' },
  { id: 'rear', label: 'Rear' },
];

const PANEL_VIEWS: Record<WrapPanel, VehicleView[]> = {
  hood: ['front'],
  cabin: ['front', 'side'],
  doors: ['side'],
  side: ['side'],
  quarter: ['side'],
  rear: ['rear'],
  rearWindow: ['rear'],
};

/** Which camera angles show vinyl for this wrap size. */
export function viewsFor(type: string, dimension: string): VehicleView[] {
  const covered = new Set<VehicleView>();
  for (const panel of wrapPanelsFor(type, dimension)) {
    for (const view of PANEL_VIEWS[panel]) covered.add(view);
  }
  return VEHICLE_VIEWS.map((row) => row.id).filter((id) => covered.has(id));
}

export function viewIsWrapped(type: string, dimension: string, view: VehicleView): boolean {
  return viewsFor(type, dimension).includes(view);
}

/**
 * Eight turntable frames. Left-side angles reuse the right-side photo
 * mirrored — the vehicles are symmetric enough that a second shoot is
 * not worth the jump.
 */
export type SpinFrameId =
  | 'front'
  | 'front-right'
  | 'side'
  | 'rear-right'
  | 'rear'
  | 'rear-left'
  | 'side-left'
  | 'front-left';

export interface SpinFrame {
  id: SpinFrameId;
  view: VehicleView;
  also?: VehicleView[];
  mirror: boolean;
  file: 'front' | 'front-right' | 'side' | 'rear-right' | 'rear';
}

export const SPIN_FRAMES: SpinFrame[] = [
  { id: 'front', view: 'front', mirror: false, file: 'front' },
  { id: 'front-right', view: 'front', also: ['side'], mirror: false, file: 'front-right' },
  { id: 'side', view: 'side', mirror: false, file: 'side' },
  { id: 'rear-right', view: 'rear', also: ['side'], mirror: false, file: 'rear-right' },
  { id: 'rear', view: 'rear', mirror: false, file: 'rear' },
  { id: 'rear-left', view: 'rear', also: ['side'], mirror: true, file: 'rear-right' },
  { id: 'side-left', view: 'side', mirror: true, file: 'side' },
  { id: 'front-left', view: 'front', also: ['side'], mirror: true, file: 'front-right' },
];

/** Start on the side — the angle advertisers recognise first. */
export const SIDE_FRAME: SpinFrame =
  SPIN_FRAMES.find((row) => row.id === 'side') ?? SPIN_FRAMES[0]!;
export const SIDE_FRAME_INDEX = SPIN_FRAMES.indexOf(SIDE_FRAME);

export function snapIndexFor(view: VehicleView): number {
  return SPIN_FRAMES.findIndex((row) => row.id === view);
}

export function frameIsWrapped(type: string, dimension: string, frame: SpinFrame): boolean {
  if (viewIsWrapped(type, dimension, frame.view)) return true;
  return (frame.also ?? []).some((view) => viewIsWrapped(type, dimension, view));
}

const STEM: Record<string, string> = {
  AUTO: 'auto',
  CAB: 'cab',
  BUS: 'bus',
  TRUCK: 'truck',
  TEMPO: 'tempo',
};

export function spinPhoto(type: string, frame: SpinFrame, wrapped: boolean): string {
  const stem = STEM[type] ?? 'cab';
  if (frame.file === 'side') {
    return wrapped ? `/vehicles/${stem}-wrap-side.jpg` : `/vehicles/${stem}.jpg`;
  }
  return wrapped ? `/vehicles/${stem}-wrap-${frame.file}.jpg` : `/vehicles/${stem}-${frame.file}.jpg`;
}

/** Tempo side photos were shot facing the other way; flip the right-side frame only. */
export function spinMirror(type: string, frame: SpinFrame): boolean {
  if (type === 'TEMPO' && frame.file === 'side') return !frame.mirror;
  return frame.mirror;
}
