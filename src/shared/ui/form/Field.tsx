import type { ReactNode } from 'react';
import * as Label from '@radix-ui/react-label';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

interface FieldProps {
  label: string;
  htmlFor: string;
  hintId: string;
  errorId: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Label above, control, then hint and error beneath it.
 *
 * The message sits below the control so it never reflows the label or shifts
 * the control itself as it appears and disappears.
 */
export function Field({
  label,
  htmlFor,
  hintId,
  errorId,
  hint,
  error,
  required,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <Label.Root
        htmlFor={htmlFor}
        className="block text-[13px] font-medium text-slate-700 select-none"
      >
        {label}
        {required ? (
          <span className="ml-0.5 text-rose-600" aria-hidden>
            *
          </span>
        ) : null}
      </Label.Root>

      <div className="mt-1.5">{children}</div>

      {hint ? (
        <p id={hintId} className="mt-1.5 text-[11px] text-slate-500">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 flex items-start gap-1.5 text-[11px] font-medium text-rose-600"
        >
          <AlertCircle className="mt-px size-3 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
