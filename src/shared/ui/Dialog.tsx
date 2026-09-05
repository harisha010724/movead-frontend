import type { ReactNode } from 'react';
import * as RDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * `xl` is for a two-column body — a form beside a map. Do not reach for it to
   * fit a long single column: a form the eye has to track across 900px is
   * harder to read than the same form scrolled.
   */
  size?: 'md' | 'lg' | 'xl';
  /**
   * Blocks dismissal by overlay click and Escape. Use while a submission is in
   * flight, so a stray click cannot close a dialog mid-write and leave the user
   * unsure whether it succeeded.
   */
  dismissible?: boolean;
}

type OutsideEvent = CustomEvent<{ originalEvent: Event }>;

const SIZES = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  // Room for a form column beside a map worth reading. Stops here rather than
  // going wider so the panel still sits inside a 1280px laptop with a margin —
  // a dialog that reaches the edges reads as a broken page, not as a dialog.
  xl: 'max-w-6xl',
} as const;

/**
 * Third-party popovers that belong to a field inside the dialog but are
 * attached to <body> rather than to the field.
 *
 * Google's Places Autocomplete builds its suggestion list that way, so picking
 * a suggestion registers as a click outside and Radix closes the dialog out
 * from under the user — mid-form, losing everything they had typed. It is part
 * of the field, so it counts as inside.
 */
function isDetachedPopover(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('.pac-container') !== null;
}

/**
 * Radix Dialog handles the parts that are easy to get wrong by hand: focus
 * moves into the panel on open and returns to the trigger on close, focus is
 * trapped while open, the rest of the page is hidden from screen readers, and
 * body scroll is locked.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
}: DialogProps) {
  const block = (event: Event) => {
    if (!dismissible) event.preventDefault();
  };

  const blockOutside = (event: OutsideEvent) => {
    if (!dismissible || isDetachedPopover(event.detail.originalEvent.target)) {
      event.preventDefault();
    }
  };

  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="popover-anim fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px]" />
        <RDialog.Content
          onPointerDownOutside={blockOutside}
          onEscapeKeyDown={block}
          onInteractOutside={blockOutside}
          className={cn(
            'popover-anim fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col',
            'rounded-2xl bg-white shadow-xl',
            SIZES[size],
          )}
        >
          <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
            <div className="min-w-0">
              <RDialog.Title className="text-[17px] font-semibold tracking-tight text-slate-900">
                {title}
              </RDialog.Title>
              {description ? (
                <RDialog.Description className="mt-1 text-[13px] text-slate-500">
                  {description}
                </RDialog.Description>
              ) : null}
            </div>
            <RDialog.Close
              className="-mt-1 -mr-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none"
              aria-label="Close"
            >
              <X className="size-4" />
            </RDialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>

          {footer ? (
            <div className="flex items-center justify-end gap-2.5 rounded-b-2xl border-t border-slate-100 bg-slate-50/70 px-6 py-4">
              {footer}
            </div>
          ) : null}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
