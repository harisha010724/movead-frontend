import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronLeft, ChevronRight, Layers2, Maximize2 } from 'lucide-react';

import { Button, Dialog } from '@/shared/ui';
import { adDimensionLabel, adDimensionsFor, vehicleTypeLabel } from './vehicleCatalog';
import {
  SIDE_FRAME,
  SIDE_FRAME_INDEX,
  SPIN_FRAMES,
  VEHICLE_VIEWS,
  frameIsWrapped,
  snapIndexFor,
  spinMirror,
  spinPhoto,
  viewsFor,
  type VehicleView,
} from './vehiclePreview';

const PX_PER_FRAME = 36;

/**
 * A compact card on the form. The 360° turntable opens in a dialog so the
 * advertiser can drag around the vehicle without the create page jumping.
 */
export function VehicleAdPreview({
  vehicleType,
  adDimension,
}: {
  vehicleType: string;
  adDimension: string;
}) {
  const [open, setOpen] = useState(false);
  const kind = vehicleTypeLabel(vehicleType);
  const size = adDimensionsFor(vehicleType).find((row) => row.value === adDimension);
  const sizeName = adDimensionLabel(vehicleType, adDimension);
  const thumbView = viewsFor(vehicleType, adDimension)[0] ?? 'side';
  const thumbFrame = SPIN_FRAMES.find((row) => row.id === thumbView) ?? SIDE_FRAME;
  const thumbWrapped = frameIsWrapped(vehicleType, adDimension, thumbFrame);

  return (
    <div data-testid="vehicle-ad-preview" data-vehicle={vehicleType} data-dimension={adDimension}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-brand-500/40 hover:bg-slate-50"
        aria-label={`View 360° wrap on ${kind}. ${sizeName || 'Ad size'}.`}
      >
        <span className="relative block h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-100">
          <img
            src={spinPhoto(vehicleType, thumbFrame, thumbWrapped)}
            alt=""
            className={`size-full object-cover object-center ${spinMirror(vehicleType, thumbFrame) ? '-scale-x-100' : ''}`}
          />
          <span className="absolute top-1 left-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
            360°
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-800">
            <Layers2 className="size-3.5 shrink-0 text-slate-400" aria-hidden />
            Vehicle wrap
          </span>
          <span className="mt-0.5 block text-[12px] text-slate-500">
            {kind}
            {sizeName ? ` · ${sizeName}` : ''}
            {size?.hint ? ` · ${size.hint}` : ''}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-brand-500">
          <Maximize2 className="size-3.5" aria-hidden />
          View 360°
        </span>
      </button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`${kind} · 360°`}
        description={`${sizeName || 'Ad size'}. Drag to turn and see where the wrap sits.`}
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Done
          </Button>
        }
      >
        {open ? <VehicleSpinStage vehicleType={vehicleType} adDimension={adDimension} /> : null}
      </Dialog>
    </div>
  );
}

function VehicleSpinStage({
  vehicleType,
  adDimension,
}: {
  vehicleType: string;
  adDimension: string;
}) {
  const kind = vehicleTypeLabel(vehicleType);
  const sizeName = adDimensionLabel(vehicleType, adDimension);
  const [index, setIndex] = useState(SIDE_FRAME_INDEX);
  const drag = useRef({ active: false, startX: 0, startIndex: SIDE_FRAME_INDEX });
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIndex(SIDE_FRAME_INDEX);
  }, [vehicleType]);

  useEffect(() => {
    for (const frame of SPIN_FRAMES) {
      const img = new Image();
      img.src = spinPhoto(vehicleType, frame, frameIsWrapped(vehicleType, adDimension, frame));
    }
  }, [vehicleType, adDimension]);

  useEffect(() => {
    stageRef.current?.focus();
  }, []);

  const frame = SPIN_FRAMES[index] ?? SIDE_FRAME;
  const wrapped = frameIsWrapped(vehicleType, adDimension, frame);
  const src = spinPhoto(vehicleType, frame, wrapped);
  const mirror = spinMirror(vehicleType, frame);

  function turn(delta: number) {
    setIndex((current) => (current + delta + SPIN_FRAMES.length) % SPIN_FRAMES.length);
  }

  function snap(view: VehicleView) {
    setIndex(snapIndexFor(view));
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { active: true, startX: event.clientX, startIndex: index };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current.active) return;
    const moved = Math.round((event.clientX - drag.current.startX) / PX_PER_FRAME);
    setIndex((drag.current.startIndex - moved + SPIN_FRAMES.length * 8) % SPIN_FRAMES.length);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    drag.current.active = false;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <div
        ref={stageRef}
        data-testid="vehicle-spin"
        data-frame={frame.id}
        data-wrapped={wrapped ? 'true' : 'false'}
        role="img"
        aria-label={`${kind} 360 preview. ${sizeName || 'Ad size'}. Drag to turn.`}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            turn(-1);
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            turn(1);
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative aspect-video w-full cursor-grab touch-none bg-slate-100 select-none active:cursor-grabbing"
      >
        <img
          src={src}
          alt=""
          draggable={false}
          className={`pointer-events-none absolute inset-0 size-full object-contain object-center ${mirror ? '-scale-x-100' : ''}`}
        />
        <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-slate-700 shadow-sm">
          360°
        </span>
        {wrapped ? (
          <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-brand-500/10 px-2.5 py-1 text-[11px] font-medium text-brand-500">
            Wrapped
          </span>
        ) : (
          <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] text-slate-400">
            No wrap
          </span>
        )}
        <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-[11px] text-slate-500 shadow-sm">
          Drag to turn
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-3 py-2.5">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Turn left"
            className="size-8 px-0"
            onClick={() => turn(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="flex items-center gap-1 px-1">
            {SPIN_FRAMES.map((row, i) => (
              <span
                key={row.id}
                className={`size-1.5 rounded-full ${i === index ? 'bg-brand-500' : 'bg-slate-200'}`}
              />
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Turn right"
            className="size-8 px-0"
            onClick={() => turn(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          {VEHICLE_VIEWS.map((view) => (
            <Button
              key={view.id}
              variant={frame.view === view.id && !frame.mirror ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2.5 text-[12px]"
              onClick={() => snap(view.id)}
            >
              {view.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
