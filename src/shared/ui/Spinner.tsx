import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2 className={cn('size-5 animate-spin text-slate-400', className)} aria-hidden />
  );
}

export function FullPageSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <Spinner className="size-7" />
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}
