import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { formatSignedPercent } from '@/shared/format';

interface ChangeIndicatorProps {
  /** Period-over-period change as a ratio: 0.186 means +18.6%. */
  ratio: number | null | undefined;
  /**
   * WEB-007: for most metrics a rise is good, but for cost per km a fall is.
   * The direction of the arrow and the colour must be decided separately.
   */
  lowerIsBetter?: boolean;
  comparisonLabel?: string;
  className?: string;
}

export function ChangeIndicator({
  ratio,
  lowerIsBetter = false,
  comparisonLabel,
  className,
}: ChangeIndicatorProps) {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) {
    return <span className={cn('text-[11px] text-slate-400', className)}>No comparison</span>;
  }

  const isFlat = Math.abs(ratio) < 0.0005;
  const isUp = ratio > 0;
  const isFavourable = isFlat ? null : lowerIsBetter ? !isUp : isUp;

  const Icon = isFlat ? Minus : isUp ? ArrowUp : ArrowDown;

  const tone =
    isFavourable === null
      ? 'text-slate-500'
      : isFavourable
        ? 'text-[color:var(--color-positive)]'
        : 'text-[color:var(--color-negative)]';

  return (
    <span
      className={cn('inline-flex flex-wrap items-baseline gap-x-1.5 text-[11px]', className)}
    >
      <span className={cn('inline-flex items-center gap-0.5 font-semibold', tone)}>
        <Icon className="size-3" aria-hidden />
        <span className="numeric">
          {isFlat ? 'No change' : formatSignedPercent(ratio).replace('+', '')}
        </span>
      </span>
      {comparisonLabel ? <span className="text-slate-400">vs {comparisonLabel}</span> : null}
    </span>
  );
}
