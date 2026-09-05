import { AlertCircle } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

/**
 * Form-level failure, for errors that belong to the submission rather than to
 * one field — a rejected login, a server error, a depleted wallet.
 *
 * Field-level problems belong under their own control, not here.
 */
export function FormError({ message, className }: { message?: string; className?: string }) {
  if (!message) return null;

  return (
    <p
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-[13px] text-rose-700',
        className,
      )}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}
