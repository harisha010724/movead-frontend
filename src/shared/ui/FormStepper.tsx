import { Check } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

export interface FormStep {
  id: string;
  label: string;
  hint?: string;
}

/**
 * Vertical step list with a progress bar. Sits on the left of a wizard
 * so the form and the preview keep their own columns.
 */
export function FormStepper({
  steps,
  current,
  farthest,
  onSelect,
  className,
}: {
  steps: readonly FormStep[];
  current: number;
  farthest: number;
  onSelect?: (index: number) => void;
  className?: string;
}) {
  const total = steps.length;
  const safeCurrent = Math.min(Math.max(current, 0), Math.max(total - 1, 0));
  const percent = total === 0 ? 0 : Math.round(((safeCurrent + 1) / total) * 100);
  const active = steps[safeCurrent];

  return (
    <nav
      aria-label="Form steps"
      data-testid="form-stepper"
      data-step={active?.id}
      data-percent={percent}
      className={cn(
        'rounded-2xl bg-white px-4 py-5 shadow-card sm:px-5',
        className,
      )}
    >
      <div className="flex items-end justify-between gap-3">
        <p className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">
          Step {safeCurrent + 1} of {total}
        </p>
        <p className="numeric text-[13px] font-semibold text-brand-500">{percent}%</p>
      </div>

      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        <div
          className="h-full rounded-full bg-brand-500 transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ol className="mt-5 space-y-1">
        {steps.map((step, index) => {
          const done = index < safeCurrent;
          const here = index === safeCurrent;
          const reachable = index <= farthest;
          return (
            <li key={step.id}>
              <button
                type="button"
                disabled={!reachable}
                aria-label={step.label}
                aria-current={here ? 'step' : undefined}
                onClick={() => onSelect?.(index)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left transition-colors',
                  reachable ? 'hover:bg-slate-50' : 'cursor-not-allowed',
                  here && 'bg-brand-50/80',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold',
                    (done || here) && 'bg-brand-500 text-white',
                    !done && !here && 'bg-slate-100 text-slate-400',
                  )}
                >
                  {done ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span className="min-w-0 pt-0.5">
                  <span
                    className={cn(
                      'block text-[13px] font-semibold',
                      here || done ? 'text-slate-900' : 'text-slate-400',
                    )}
                  >
                    {step.label}
                  </span>
                  {step.hint ? (
                    <span
                      className={cn(
                        'mt-0.5 block text-[12px] leading-snug',
                        here ? 'text-slate-500' : 'text-slate-400',
                      )}
                    >
                      {step.hint}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
