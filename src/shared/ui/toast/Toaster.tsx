import * as RToast from '@radix-ui/react-toast';
import { AlertTriangle, CheckCircle2, Info, X, XCircle, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useToastStore, type ToastVariant } from './toastStore';

const variants: Record<ToastVariant, { icon: LucideIcon; ring: string; tint: string }> = {
  info: { icon: Info, ring: 'ring-sky-200', tint: 'text-sky-600' },
  success: { icon: CheckCircle2, ring: 'ring-emerald-200', tint: 'text-emerald-600' },
  warning: { icon: AlertTriangle, ring: 'ring-amber-200', tint: 'text-amber-600' },
  danger: { icon: XCircle, ring: 'ring-rose-200', tint: 'text-rose-600' },
};

/**
 * Mounted once near the root. Radix owns the accessibility that is easy to get
 * wrong here: a live region screen readers announce without stealing focus,
 * F6 to jump to the stack, and a hover that pauses the timer so a message
 * cannot expire while it is being read.
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <RToast.Provider swipeDirection="right">
      {toasts.map((item) => {
        const { icon: Icon, ring, tint } = variants[item.variant];

        return (
          <RToast.Root
            key={item.id}
            // A `danger` toast with duration 0 stays until dismissed. Radix
            // treats any falsy duration as "use the provider default", so the
            // sentinel has to be a number large enough to mean never.
            duration={item.duration === 0 ? Number.MAX_SAFE_INTEGER : item.duration}
            onOpenChange={(open) => {
              if (!open) dismiss(item.id);
            }}
            className={cn(
              'toast-anim pointer-events-auto flex w-[min(24rem,calc(100vw-2rem))] items-start gap-3 rounded-xl bg-white p-4 shadow-lg ring-1',
              ring,
            )}
          >
            <Icon className={cn('mt-px size-[18px] shrink-0', tint)} aria-hidden />

            <div className="min-w-0 flex-1">
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
          </RToast.Root>
        );
      })}

      <RToast.Viewport className="pointer-events-none fixed top-4 right-4 z-[100] flex max-h-screen w-auto flex-col gap-2 outline-none" />
    </RToast.Provider>
  );
}
