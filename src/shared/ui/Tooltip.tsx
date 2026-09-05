import type { ReactNode } from 'react';
import * as RTooltip from '@radix-ui/react-tooltip';

/**
 * Mounted once near the root. Radix uses it to share the open delay between
 * tooltips, so moving between adjacent icon buttons does not re-wait.
 */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <RTooltip.Provider delayDuration={300} skipDelayDuration={300}>
      {children}
    </RTooltip.Provider>
  );
}

export function Tooltip({
  label,
  side = 'top',
  children,
}: {
  label: string;
  /** `right` is what the collapsed sidebar rail needs; a tooltip above an icon
   *  in a narrow column overlaps the item above it. */
  side?: 'top' | 'right' | 'bottom' | 'left';
  children: ReactNode;
}) {
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          sideOffset={6}
          className="popover-anim z-50 rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white"
        >
          {label}
          <RTooltip.Arrow className="fill-slate-900" />
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}
