import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export function Table({
  children,
  caption,
  dense = false,
}: {
  children: ReactNode;
  caption?: string;
  /** Tighter cells for dashboard panels, where many columns share a narrow card. */
  dense?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cn(
          'w-full border-collapse text-[13px]',
          dense && '[&_td]:px-2.5 [&_td]:py-2.5 [&_th]:px-2.5 [&_th]:py-2.5',
        )}
      >
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-slate-50/80">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

export function TR({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <tr className={cn('transition-colors hover:bg-slate-50/60', className)}>{children}</tr>
  );
}

/**
 * WEB-006: numeric columns always use tabular figures so digits do not shift
 * as values update. Alignment is separate — right reads best when amounts are
 * meant to be compared down the column, but the dashboard panels follow the
 * design and align left, so `align` is explicit rather than implied.
 */
type Align = 'left' | 'right';

export function TH({
  children,
  numeric = false,
  align,
  className,
}: {
  children: ReactNode;
  numeric?: boolean;
  align?: Align;
  className?: string;
}) {
  const resolved = align ?? (numeric ? 'right' : 'left');
  return (
    <th
      scope="col"
      className={cn(
        'px-4 py-3 text-[11px] font-medium whitespace-nowrap text-slate-500',
        resolved === 'right' ? 'text-right' : 'text-left',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TD({
  children,
  numeric = false,
  align,
  className,
}: {
  children: ReactNode;
  numeric?: boolean;
  align?: Align;
  className?: string;
}) {
  const resolved = align ?? (numeric ? 'right' : 'left');
  return (
    <td
      className={cn(
        'px-4 py-3 whitespace-nowrap text-slate-700',
        numeric && 'numeric',
        resolved === 'right' ? 'text-right' : 'text-left',
        className,
      )}
    >
      {children}
    </td>
  );
}
