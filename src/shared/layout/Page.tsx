import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { TopBar } from './TopBar';

interface PageProps {
  title: string;
  greeting?: string;
  /** Page-level controls rendered in the top bar, e.g. filters or a date range. */
  controls?: ReactNode;
  notificationCount?: number;
  /** Extra classes on the padded content column (e.g. a fill-height layout). */
  contentClassName?: string;
  children: ReactNode;
}

/** Top bar plus the padded content column, so every route lines up. */
export function Page({
  title,
  greeting,
  controls,
  notificationCount,
  contentClassName,
  children,
}: PageProps) {
  return (
    <>
      <TopBar
        title={title}
        {...(greeting ? { greeting } : {})}
        {...(controls ? { controls } : {})}
        {...(notificationCount !== undefined ? { notificationCount } : {})}
      />
      <div className={cn('flex-1 px-6 py-6', contentClassName)}>{children}</div>
    </>
  );
}
