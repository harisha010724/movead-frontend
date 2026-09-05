import { useId, type CSSProperties } from 'react';

/** Globe centre and radius, in viewBox units. Everything else derives from these. */
const CX = 400;
const CY = 430;
const R = 232;

/**
 * Latitude lines. A parallel at height dy above the equator is an ellipse of
 * half-width sqrt(R² − dy²), squashed vertically by the tilt we view it at.
 */
const PARALLELS = [-152, -80, 0, 80, 152].map((dy) => ({
  dy,
  rx: Math.round(Math.sqrt(R * R - dy * dy)),
}));

/**
 * Longitude lines. All are authored as full circles; the CSS spin scales each
 * horizontally out of phase with the others, which is what turns four ellipses
 * into one rotating sphere. Delays are spread across the 32s there-and-back
 * cycle.
 *
 * `scale` is the resting angle each one holds when the animation is switched
 * off. A CSS animation outranks an inline style, so this only takes effect
 * under prefers-reduced-motion — without it every meridian would sit at full
 * width on top of the rim and the globe would lose its wireframe.
 */
const MERIDIANS = [
  { delay: '0s', scale: 0.88 },
  { delay: '-8s', scale: 0.6 },
  { delay: '-16s', scale: 0.32 },
  { delay: '-24s', scale: 0.08 },
];

function polar(degrees: number, radius: number) {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: Math.round(CX + radius * Math.cos(radians)),
    y: Math.round(CY + radius * Math.sin(radians)),
  };
}

/**
 * Locations ring the globe just inside the rim. The half-step offset keeps
 * every pin off the vertical axis, so the circuit through them has a flat top
 * and bottom rather than a point.
 *
 * Beacons land on alternating pins: one on each would be eight things pulsing
 * at once.
 */
const PIN_COUNT = 8;
const PIN_RADIUS = Math.round(R * 0.88);

const PINS = Array.from({ length: PIN_COUNT }, (_, index) => ({
  ...polar(-180 + (index + 0.5) * (360 / PIN_COUNT), PIN_RADIUS),
  beacon: index % 2 === 0,
  delay: `${-index * 0.7}s`,
}));

/**
 * How far back from each pin the bend starts, in viewBox units, out of a
 * ~156-unit side. Enough to sweep the vehicle through the corner instead of
 * snapping its heading, while leaving a clear straight down the middle of every
 * leg. The road cuts about eight units inside the pin at each bend, which reads
 * as a landmark on the outside of the curve.
 */
const BEND = 42;

/**
 * One closed circuit joining every location. Derived from the pins themselves,
 * so the dashed trail, the pins and the path the vehicles follow cannot drift
 * apart.
 *
 * The pins are evenly spaced on a circle, so every leg — bend plus straight —
 * is identical and takes exactly an eighth of the path. `route-turn` in the
 * stylesheet depends on that, and on the bend being the first third of a leg,
 * which keeps the two mirror points on the straight part of the vertical legs.
 */
function roundedRing(points: { x: number; y: number }[], bend: number) {
  const at = (index: number) => points[(index + points.length) % points.length]!;

  const towards = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const [dx, dy] = [to.x - from.x, to.y - from.y];
    const length = Math.hypot(dx, dy);
    const round = (value: number) => Math.round(value * 10) / 10;
    return `${round(from.x + (dx / length) * bend)} ${round(from.y + (dy / length) * bend)}`;
  };

  const legs = points.map((vertex, index) => {
    const enter = towards(vertex, at(index - 1));
    const leave = towards(vertex, at(index + 1));
    return `${index === 0 ? 'M' : 'L'} ${enter} Q ${vertex.x} ${vertex.y} ${leave}`;
  });

  // `Z` draws the straight from the last bend back to the first, closing the
  // final leg rather than adding one.
  return `${legs.join(' ')} Z`;
}

const RING = roundedRing(PINS, BEND);

const LAP_SECONDS = 60;
/** Where `route-turn` mirrors the glyph, as a percentage of the lap. */
const TURN_AT = { right: 43.5, left: 93.5 };

/**
 * Which legs the vehicles park on when the animation is off, which is what
 * prefers-reduced-motion shows. They sit mid-leg, and the legs are picked to
 * spread out and to skip the two vertical ones (3 and 7), where a parked
 * vehicle would sit nose-up.
 *
 * Deliberately not derived from the lap spacing: three vehicles do not divide
 * eight legs, so any evenly spaced set leaves one parked on a pin with its glow
 * merged into it.
 */
const PARKED_ON_LEGS = [0, 2, 5];

/**
 * Traffic on the circuit. One shared lap time with evenly spread delays keeps
 * the vehicles equidistant forever; different speeds would let them bunch up
 * and overlap.
 */
const VEHICLES = PARKED_ON_LEGS.map((leg, index) => {
  const offset = (leg + 0.5) * (100 / PIN_COUNT);

  return {
    offset: `${offset}%`,
    delay: `${-index * (LAP_SECONDS / PARKED_ON_LEGS.length)}s`,
    facing: offset > TURN_AT.right && offset < TURN_AT.left ? -1 : 1,
  };
});

/**
 * The audience, scattered on the ground inside the ring of roads. They are what
 * makes the artwork say "vehicles carry ads that get seen" rather than just
 * "vehicles move".
 *
 * Hand-placed rather than generated: anything evenly spaced reads as a second
 * route. They are all one size and one weight so the scatter stays a texture
 * and never competes with the traffic.
 */
const PEOPLE = [
  { x: 342, y: 286 },
  { x: 475, y: 310 },
  { x: 286, y: 360 },
  { x: 411, y: 401 },
  { x: 295, y: 510 },
  { x: 478, y: 521 },
  { x: 388, y: 544 },
];

function Person({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity="0.45">
      {/* Lucide's user glyph, centred on the point and scaled to pin height. */}
      <g
        transform="translate(-10.8 -10.8) scale(0.9)"
        fill="none"
        stroke="#c3cdf7"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </g>
    </g>
  );
}

function Pin({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(1.05)`} opacity="0.75">
      <g transform="translate(-7 -18)">
        <path
          d="M7 0C3.1 0 0 3.1 0 7c0 5.2 7 11 7 11s7-5.8 7-11c0-3.9-3.1-7-7-7z"
          className="text-brand-400"
          fill="currentColor"
        />
        <circle cx="7" cy="7" r="2.6" className="text-sidebar" fill="currentColor" />
      </g>
    </g>
  );
}

interface VehicleProps {
  offset: string;
  delay: string;
  facing: number;
  glow: string;
}

function Vehicle({ offset, delay, facing, glow }: VehicleProps) {
  const timing = {
    animationDuration: `${LAP_SECONDS}s`,
    animationDelay: delay,
  };

  return (
    <g
      className="route-vehicle"
      style={
        {
          '--route': `path('${RING}')`,
          offsetDistance: offset,
          ...timing,
        } as CSSProperties
      }
    >
      {/*
        A halo, so the vehicle carries its own light on the dark panel. Wide and
        weak rather than small and bright: a tight halo burns a hot spot into
        the sphere and the car ends up looking stamped onto a purple blob.
      */}
      <ellipse cx="0" cy="0" rx="48" ry="37" fill={`url(#${glow})`} />

      {/*
        Lucide's car glyph, the same one as the brand mark, scaled and centred
        on the path. Drawn inline rather than as the component so it can be
        transformed here; a solid silhouette at this size read as an amoeba.

        The mirror that turns it at the far sides of the circuit is its own
        animation, sharing the lap timing. `transform` here is the resting
        facing, which only shows when the animation is off.
      */}
      <g
        className="route-turn"
        opacity="0.85"
        style={{ ...timing, transform: `scaleY(${facing})` }}
      >
        <g
          transform="translate(-18.6 -20.2) scale(1.55)"
          fill="none"
          stroke="#e4e7ff"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
          <circle cx="7" cy="17" r="2" />
          <path d="M9 17h6" />
          <circle cx="17" cy="17" r="2" />
        </g>
      </g>
    </g>
  );
}

/**
 * A slowly turning globe on the sign-in brand panel, with vehicles driving
 * routes across its surface. Purely decorative, so it is hidden from assistive
 * tech, and every animation stops under the global prefers-reduced-motion rule
 * — which leaves a static wireframe rather than a blank panel.
 */
export function AuthArtwork() {
  const glowId = useId();
  const vehicleGlowId = useId();
  const surfaceId = useId();

  return (
    <svg
      viewBox="0 0 800 1000"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 size-full"
      aria-hidden
      focusable="false"
    >
      <defs>
        {/* The atmosphere: a wide brand halo bleeding off the sphere. */}
        <radialGradient id={glowId} cx="50%" cy="43%" r="42%">
          <stop offset="55%" stopColor="var(--color-brand-500)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0" />
        </radialGradient>

        {/* Lit from the upper left, so the sphere reads as a solid body. */}
        <radialGradient id={surfaceId} cx="36%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#1d3358" />
          <stop offset="60%" stopColor="#122544" />
          <stop offset="100%" stopColor="#0a172c" />
        </radialGradient>

        <radialGradient id={vehicleGlowId}>
          <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.45" />
          <stop offset="45%" stopColor="var(--color-brand-500)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="800" height="1000" fill={`url(#${glowId})`} />

      {/* A faint street grid behind the globe, so it sits on something. */}
      <g stroke="white" strokeWidth="1" opacity="0.05" fill="none">
        {[140, 340, 540, 740, 940].map((y) => (
          <path key={`h${y}`} d={`M-10 ${y} H810`} />
        ))}
        {[110, 310, 510, 710].map((x) => (
          <path key={`v${x}`} d={`M${x} -10 V1010`} />
        ))}
      </g>

      <circle cx={CX} cy={CY} r={R} fill={`url(#${surfaceId})`} />

      <g fill="none" stroke="white" strokeWidth="1.1" opacity="0.1">
        {PARALLELS.map((p) => (
          <ellipse key={p.dy} cx={CX} cy={CY + p.dy} rx={p.rx} ry={Math.round(p.rx * 0.2)} />
        ))}
        {MERIDIANS.map((meridian) => (
          <ellipse
            key={meridian.delay}
            className="globe-meridian"
            cx={CX}
            cy={CY}
            rx={R}
            ry={R}
            style={{
              animationDelay: meridian.delay,
              transform: `scaleX(${meridian.scale})`,
            }}
          />
        ))}
      </g>

      {/* Rim light, drawn last so it sits over the wireframe. */}
      <circle
        cx={CX}
        cy={CY}
        r={R}
        fill="none"
        className="text-brand-400"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.22"
      />

      {/* Under the circuit, so the traffic always reads on top of the crowd. */}
      {PEOPLE.map((person) => (
        <Person key={`${person.x},${person.y}`} {...person} />
      ))}

      {/*
        The dash period must match the distance `route-dash` travels, or the
        dots visibly snap back at the end of every cycle.
      */}
      <path
        d={RING}
        className="route-trail text-brand-300"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="2 14"
        fill="none"
        opacity="0.5"
      />

      {PINS.map((pin) => (
        <g key={`${pin.x},${pin.y}`}>
          {pin.beacon ? (
            <g transform={`translate(${pin.x} ${pin.y})`}>
              <circle
                className="route-ping text-brand-400"
                r="6"
                fill="currentColor"
                opacity="0.25"
                style={{ animationDelay: pin.delay }}
              />
            </g>
          ) : null}
          <Pin x={pin.x} y={pin.y} />
        </g>
      ))}

      {/* Last, so a car passes over the pins rather than under them. */}
      {VEHICLES.map((vehicle) => (
        <Vehicle
          key={vehicle.offset}
          offset={vehicle.offset}
          delay={vehicle.delay}
          facing={vehicle.facing}
          glow={vehicleGlowId}
        />
      ))}
    </svg>
  );
}
