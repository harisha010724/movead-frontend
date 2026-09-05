import { useState, type ComponentType } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, Headphones } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useAuth } from '@/shared/auth/useAuth';
import type { Permission } from '@/shared/auth/permissions';
import { useUiStore } from '@/shared/state/uiStore';
import { Menu, MenuItem, MenuLabel, MenuSeparator, Tooltip } from '@/shared/ui';

export interface NavChild {
  to: string;
  label: string;
  permission?: Permission;
}

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  permission?: Permission;
  end?: boolean;
  children?: NavChild[];
}

interface SidebarProps {
  productName: string;
  nav: NavItem[];
  showSupportCard?: boolean;
}

/** Shared by every nav row so the collapsed rail and the full sidebar line up. */
const ROW = 'flex items-center rounded-lg py-2.5 text-[13px] text-white transition-colors';
const ACTIVE = 'bg-brand-500 font-medium shadow-[0_2px_8px_rgb(99_102_241/0.4)]';

/**
 * Active state is resolved here rather than through NavLink's `className`
 * callback because collapsed rows are wrapped in a Radix tooltip. Radix merges
 * an `asChild` child's props by string-joining `className`, so a callback gets
 * stringified into the class list and the row silently loses all styling —
 * including its text colour, which leaves a near-black icon on a navy rail.
 */
function isActiveRoute(pathname: string, to: string, end: boolean) {
  return end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
}

export function Sidebar({ productName, nav, showSupportCard = true }: SidebarProps) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const [expanded, setExpanded] = useState<string | null>(null);

  const isVisible = (permission?: Permission) => !permission || can(permission);
  const visible = nav.filter((item) => isVisible(item.permission));
  const collapseLabel = collapsed ? 'Expand sidebar' : 'Collapse sidebar';

  /*
   * Above the TopBar's z-30, because the toggle straddles the seam and so
   * overhangs the header. `position: sticky` makes this a stacking context
   * whatever the z-index, so the header would otherwise paint over the
   * overhanging half of the button.
   */
  return (
    <aside
      id="app-sidebar"
      className={cn(
        'sticky top-0 z-40 flex h-screen shrink-0 flex-col bg-sidebar transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-56',
      )}
    >
      {/*
       * Centred on the sidebar's own header row, so it lines up with the
       * wordmark on one side and the page title on the other.
       */}
      <Tooltip label={collapseLabel} side="right">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={collapseLabel}
          aria-expanded={!collapsed}
          aria-controls="app-sidebar"
          className="absolute top-8 -right-3 grid size-6 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md transition-colors hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:outline-none"
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </Tooltip>

      <div
        className={cn('flex h-16 items-center gap-2.5', collapsed ? 'justify-center' : 'px-4')}
      >
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-500">
          <span className="text-sm font-bold text-white">M</span>
        </div>
        {/* Dropped from the DOM rather than hidden, so it cannot squash the rail. */}
        {collapsed ? null : (
          <span className="text-[17px] font-semibold tracking-tight text-white">
            {productName}
          </span>
        )}
      </div>

      <nav
        className={cn(
          'scroll-slim flex-1 space-y-1 overflow-y-auto pt-2 pb-4',
          collapsed ? 'px-2' : 'px-3',
        )}
        aria-label="Main"
      >
        {visible.map((item) => {
          const children = item.children?.filter((c) => isVisible(c.permission)) ?? [];
          const hasChildren = children.length > 0;
          const isOpen = expanded === item.to;

          if (!hasChildren) {
            const link = (
              <NavLink
                to={item.to}
                end={item.end ?? false}
                className={cn(
                  ROW,
                  collapsed ? 'justify-center px-0' : 'gap-3 px-3',
                  isActiveRoute(pathname, item.to, item.end ?? false)
                    ? ACTIVE
                    : 'hover:bg-sidebar-hover',
                )}
              >
                <item.icon className="size-[18px] shrink-0" />
                {collapsed ? null : <span className="truncate">{item.label}</span>}
              </NavLink>
            );

            return (
              <div key={item.to}>
                {collapsed ? (
                  <Tooltip label={item.label} side="right">
                    {link}
                  </Tooltip>
                ) : (
                  link
                )}
              </div>
            );
          }

          /*
           * Collapsed, the accordion has nowhere to open, so the group becomes a
           * flyout. It doubles as the label, which is why these rows get no
           * tooltip — and why the parent is not simply linked to `item.to`, as
           * some groups (Impressions) are headings with no route of their own.
           *
           * The active tint is applied here but not to the expanded accordion
           * button: expanded, the open child shows you where you are, whereas
           * collapsed nothing else would.
           */
          if (collapsed) {
            const withinGroup = isActiveRoute(pathname, item.to, false);

            return (
              <Menu
                key={item.to}
                side="right"
                align="start"
                trigger={
                  <button
                    type="button"
                    aria-label={item.label}
                    className={cn(
                      ROW,
                      'w-full justify-center px-0',
                      withinGroup ? ACTIVE : 'hover:bg-sidebar-hover',
                    )}
                  >
                    <item.icon className="size-[18px] shrink-0" />
                  </button>
                }
              >
                <MenuLabel>{item.label}</MenuLabel>
                <MenuSeparator />
                {children.map((child) => (
                  <MenuItem key={child.to} onSelect={() => void navigate(child.to)}>
                    {child.label}
                  </MenuItem>
                ))}
              </Menu>
            );
          }

          return (
            <div key={item.to}>
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : item.to)}
                aria-expanded={isOpen}
                className={cn(ROW, 'w-full gap-3 px-3 hover:bg-sidebar-hover')}
              >
                <item.icon className="size-[18px] shrink-0" />
                <span className="flex-1 truncate text-left">{item.label}</span>
                <ChevronDown
                  className={cn('size-4 shrink-0 transition-transform', isOpen && 'rotate-180')}
                />
              </button>

              {isOpen ? (
                <div className="mt-0.5 space-y-0.5 pl-11">
                  {children.map((child) => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      className={({ isActive }) =>
                        cn(
                          'block rounded-md px-3 py-1.5 text-[13px] text-white transition-colors hover:bg-sidebar-hover',
                          isActive && 'font-medium',
                        )
                      }
                    >
                      {child.label}
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      {/* No room for the card on the rail, and shrinking it just makes it unreadable. */}
      {showSupportCard && !collapsed ? (
        <div className="p-3">
          <div className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-4">
            <div className="grid size-9 place-items-center rounded-full bg-white/20">
              <Headphones className="size-4 text-white" />
            </div>
            <p className="mt-3 text-sm font-semibold text-white">Need Help?</p>
            <p className="mt-1 text-xs leading-relaxed text-white/75">
              Our support team is here to help you 24/7
            </p>
            <a
              href="mailto:support@movead.in"
              className="mt-3 block rounded-lg bg-white px-3 py-2 text-center text-xs font-semibold text-brand-700 transition-colors hover:bg-white/90"
            >
              Contact Support
            </a>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
