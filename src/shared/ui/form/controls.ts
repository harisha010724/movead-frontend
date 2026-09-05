import { useId } from 'react';

/**
 * Shared control surface. Radix Primitives are unstyled by design, so every
 * control — native input, native textarea, Radix Select trigger — opts into
 * the same class here rather than each inventing its own border and ring.
 */
export const controlClass =
  'block w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 ' +
  'placeholder:text-slate-400 transition-colors ' +
  'hover:border-slate-300 ' +
  'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

export const controlHeight = 'h-9';

export const controlInvalidClass =
  'border-rose-400 hover:border-rose-400 focus:border-rose-500 focus:ring-rose-500/25';

/** Ids for the label, description and error of one field, wired consistently. */
export function useFieldIds(providedId?: string) {
  const generated = useId();
  const id = providedId ?? generated;
  return {
    id,
    hintId: `${id}-hint`,
    errorId: `${id}-error`,
  };
}

/**
 * Builds the aria-describedby value.
 *
 * Both the hint and the error are referenced when both are present, because a
 * hint such as "In rupees, excluding GST" stays relevant while the value is
 * being corrected — announcing only the error would drop it.
 */
export function describedBy(opts: {
  hintId: string;
  errorId: string;
  hasHint: boolean;
  hasError: boolean;
}): string | undefined {
  const ids = [opts.hasHint && opts.hintId, opts.hasError && opts.errorId].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}
