import type { ComponentType, ReactNode } from 'react';
import * as RMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/shared/lib/cn';

export function Menu({
  trigger,
  side = 'bottom',
  align = 'end',
  children,
}: {
  trigger: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  children: ReactNode;
}) {
  return (
    <RMenu.Root>
      <RMenu.Trigger asChild>{trigger}</RMenu.Trigger>
      <RMenu.Portal>
        <RMenu.Content
          side={side}
          align={align}
          sideOffset={6}
          className="popover-anim z-50 min-w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-panel"
        >
          {children}
        </RMenu.Content>
      </RMenu.Portal>
    </RMenu.Root>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <RMenu.Label className="px-2.5 py-2 text-[11px] text-slate-400">{children}</RMenu.Label>
  );
}

export function MenuSeparator() {
  return <RMenu.Separator className="my-1 h-px bg-slate-100" />;
}

export function MenuItem({
  children,
  onSelect,
  icon: Icon,
  destructive = false,
  disabled = false,
}: {
  children: ReactNode;
  onSelect?: () => void;
  icon?: ComponentType<{ className?: string }>;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <RMenu.Item
      disabled={disabled}
      onSelect={onSelect ?? undefined}
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] select-none',
        'data-[highlighted]:outline-none',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40',
        destructive
          ? 'text-rose-600 data-[highlighted]:bg-rose-50'
          : 'text-slate-700 data-[highlighted]:bg-slate-50 data-[highlighted]:text-slate-900',
      )}
    >
      {Icon ? <Icon className="size-4 shrink-0 opacity-70" /> : null}
      {children}
    </RMenu.Item>
  );
}
