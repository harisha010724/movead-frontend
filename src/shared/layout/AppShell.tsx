import type { ReactNode } from 'react';
import { Sidebar, type NavItem } from './Sidebar';

export type { NavItem, NavChild } from './Sidebar';

interface AppShellProps {
  productName: string;
  nav: NavItem[];
  children: ReactNode;
  showSupportCard?: boolean;
}

/**
 * The page itself renders its own TopBar, because the title, greeting and
 * page-level controls (campaign selector, date range) differ per route.
 */
export function AppShell({ productName, nav, children, showSupportCard }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>

      <Sidebar
        productName={productName}
        nav={nav}
        {...(showSupportCard !== undefined ? { showSupportCard } : {})}
      />

      <div id="main" className="flex min-w-0 flex-1 flex-col">
        {children}
      </div>
    </div>
  );
}
