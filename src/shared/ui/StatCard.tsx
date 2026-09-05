import type { ComponentType, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';
import { ChangeIndicator } from './ChangeIndicator';

export type StatTone = 'brand' | 'green' | 'blue' | 'amber' | 'rose';

const toneStyles: Record<StatTone, string> = {
  brand: 'bg-brand-50 text-brand-500',
  green: 'bg-emerald-50 text-emerald-500',
  blue: 'bg-sky-50 text-sky-500',
  amber: 'bg-amber-50 text-amber-500',
  rose: 'bg-rose-50 text-rose-500',
};

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  tone?: StatTone;
  /** Period-over-period change as a ratio: 0.186 means +18.6%. */
  change?: number | null;
  lowerIsBetter?: boolean;
  comparisonLabel?: string;
  hint?: ReactNode;
  /** ADV-020: every headline figure drills down to what produced it. */
  drillTo?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'brand',
  change,
  lowerIsBetter,
  comparisonLabel,
  hint,
  drillTo,
  className,
}: StatCardProps) {
  const body = (
    <div className="flex h-full items-start justify-between gap-3">
      <div className="min-w-0">
        {/*
          Wraps rather than truncates — a clipped metric name is not a label —
          and reserves two lines so the values stay on one baseline across the
          row even when only the longest label wraps.
        */}
        <p className="min-h-[26px] text-[11px] leading-tight text-slate-500">{label}</p>
        <p className="numeric mt-1 text-xl font-semibold tracking-tight whitespace-nowrap text-slate-900">
          {value}
        </p>
        <div className="mt-2">
          {change !== undefined ? (
            <ChangeIndicator
              ratio={change}
              lowerIsBetter={lowerIsBetter ?? false}
              {...(comparisonLabel ? { comparisonLabel } : {})}
            />
          ) : (
            <span className="text-[11px] text-slate-400">{hint}</span>
          )}
        </div>
      </div>

      {Icon ? (
        <div
          className={cn('grid size-9 shrink-0 place-items-center rounded-xl', toneStyles[tone])}
        >
          <Icon className="size-4" />
        </div>
      ) : null}
    </div>
  );

  const base = cn(
    'block h-full rounded-2xl bg-white p-5 shadow-card',
    drillTo && 'transition-shadow hover:shadow-card-hover',
    className,
  );

  return drillTo ? (
    <Link to={drillTo} className={base}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}
