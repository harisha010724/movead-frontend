import type { ReactNode } from 'react';
import * as RTabs from '@radix-ui/react-tabs';
import { cn } from '@/shared/lib/cn';

/**
 * Radix Tabs rather than buttons and conditional rendering: it handles arrow
 * key navigation, roving tabindex and the aria-controls wiring that a
 * hand-rolled tab strip almost always gets wrong.
 */
export function Tabs({
  value,
  onValueChange,
  children,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <RTabs.Root value={value} onValueChange={onValueChange} className={className}>
      {children}
    </RTabs.Root>
  );
}

export function TabList({ children, label }: { children: ReactNode; label: string }) {
  return (
    <RTabs.List aria-label={label} className="flex gap-6 border-b border-slate-200">
      {children}
    </RTabs.List>
  );
}

export function Tab({
  value,
  children,
  count,
}: {
  value: string;
  children: ReactNode;
  count?: number;
}) {
  return (
    <RTabs.Trigger
      value={value}
      className={cn(
        '-mb-px flex items-center gap-2 border-b-2 border-transparent px-1 pb-3 text-[13px] font-medium',
        'text-slate-500 transition-colors hover:text-slate-700',
        'data-[state=active]:border-brand-500 data-[state=active]:text-brand-600',
      )}
    >
      {children}
      {count !== undefined ? (
        <span className="numeric rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
          {count}
        </span>
      ) : null}
    </RTabs.Trigger>
  );
}

export function TabPanel({ value, children }: { value: string; children: ReactNode }) {
  return (
    <RTabs.Content value={value} className="mt-4 focus-visible:outline-none">
      {children}
    </RTabs.Content>
  );
}
