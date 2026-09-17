import { useSyncExternalStore } from 'react';
import * as RToast from '@radix-ui/react-toast';
import { AlertTriangle, CheckCircle2, Info, X, XCircle, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useToastStore, type ToastVariant } from './toastStore';

const variants: Record<
  ToastVariant,
  { icon: LucideIcon; ring: string; tint: string; chip: string; bar: string }
> = {
  info: {
    icon: Info,
    ring: 'ring-sky-200',
    tint: 'text-sky-600',
    chip: 'bg-sky-50',
    bar: 'bg-sky-500',
  },
  success: {
    icon: CheckCircle2,
    ring: 'ring-emerald-200',
    tint: 'text-emerald-600',
    chip: 'bg-emerald-50',
    bar: 'bg-emerald-500',
  },
  warning: {
    icon: AlertTriangle,
    ring: 'ring-amber-200',
    tint: 'text-amber-600',
    chip: 'bg-amber-50',
    bar: 'bg-amber-500',
  },
  danger: {
    icon: XCircle,
    ring: 'ring-rose-200',
    tint: 'text-rose-600',
    chip: 'bg-rose-50',
    bar: 'bg-rose-500',
  },
};

/**
 * What `duration: 0` is sent to Radix as, which treats any falsy duration as
 * "use the provider default" and so cannot be given the zero directly.
 *
 * Not an arbitrarily large number: the value reaches `setTimeout`, whose delay
 * is a signed 32-bit field, and anything above this wraps and fires on the
 * next tick. `Number.MAX_SAFE_INTEGER` overflowed that way and closed the
 * toast immediately — the exact opposite of sticky. This is the largest delay
 * that does not, about 24 days.
 */
const NEVER = 2_147_483_647;

/**
 * Radix stops a toast's timer while the window is in the background. The
 * progress bar runs on CSS, which cannot see that on its own, so it is told
 * here: without it, a tab returned to after a minute elsewhere shows a spent
 * bar above a toast with most of its life left.
 */
function subscribeToWindowFocus(onChange: () => void): () => void {
  window.addEventListener('focus', onChange);
  window.addEventListener('blur', onChange);
  return () => {
    window.removeEventListener('focus', onChange);
    window.removeEventListener('blur', onChange);
  };
}

function useWindowFocused(): boolean {
  return useSyncExternalStore(subscribeToWindowFocus, () => document.hasFocus());
}

/**
 * Mounted once near the root. Radix owns the accessibility that is easy to get
 * wrong here: a live region screen readers announce without stealing focus,
 * F6 to jump to the stack, and a hover that pauses the timer so a message
 * cannot expire while it is being read.
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const windowFocused = useWindowFocused();

  return (
    <RToast.Provider swipeDirection="right">
      {toasts.map((item) => {
        const { icon: Icon, ring, tint, chip, bar } = variants[item.variant];

        return (
          <RToast.Root
            key={item.id}
            duration={item.duration === 0 ? NEVER : item.duration}
            onOpenChange={(open) => {
              if (!open) dismiss(item.id);
            }}
            className={cn(
              'toast-anim pointer-events-auto relative flex w-[min(24rem,calc(100vw-2rem))] items-start gap-3 overflow-hidden rounded-xl bg-white p-4 shadow-lg shadow-slate-900/5 ring-1',
              ring,
            )}
          >
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full',
                chip,
              )}
            >
              <Icon className={cn('size-[18px]', tint)} aria-hidden />
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <RToast.Title className="text-[13px] font-medium text-slate-900">
                {item.title}
              </RToast.Title>
              {item.description ? (
                <RToast.Description className="mt-1 text-[13px] leading-relaxed text-slate-500">
                  {item.description}
                </RToast.Description>
              ) : null}
            </div>

            <RToast.Close
              aria-label="Dismiss"
              className="-mt-1 -mr-1 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none"
            >
              <X className="size-4" aria-hidden />
            </RToast.Close>

            {/*
             * Omitted for a toast that never expires, where a bar would be
             * counting down to nothing. Decorative: the same information is in
             * the timer Radix is already running.
             */}
            {item.duration === 0 ? null : (
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-slate-100">
                <span
                  data-testid="toast-progress"
                  className={cn('toast-progress block h-full w-full origin-left', bar)}
                  style={{ animationDuration: `${String(item.duration)}ms` }}
                />
              </span>
            )}
          </RToast.Root>
        );
      })}

      <RToast.Viewport
        data-paused={windowFocused ? undefined : ''}
        className="toast-viewport pointer-events-none fixed top-4 right-4 z-[100] flex max-h-screen w-auto flex-col gap-2 outline-none"
      />
    </RToast.Provider>
  );
}
