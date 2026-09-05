import type { ReactNode } from 'react';
import { ChevronDown, LifeBuoy, LogOut, Settings, UserRound } from 'lucide-react';
import { useAuth } from '@/shared/auth/useAuth';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/shared/ui';
import { NotificationBell } from './NotificationBell';

interface TopBarProps {
  title: string;
  greeting?: string;
  /** Campaign selector, date range picker and similar page-level controls. */
  controls?: ReactNode;
  /** @deprecated The bell reads the inbox itself. Kept so existing pages still type-check. */
  notificationCount?: number;
}

/** Initials for the avatar, e.g. "ABC Advertising" → "AC". */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function TopBar({ title, greeting, controls }: TopBarProps) {
  const { user, logout } = useAuth();
  const organisation = user?.organisationName ?? '';

  /*
   * Sticky rather than fixed: the sidebar is a flex sibling, so a fixed header
   * would need a hard-coded left offset matching the sidebar width and a
   * matching top pad on every page. Sticky pins it to the viewport with no such
   * coupling, and the content column keeps its own layout.
   *
   * Below z-40 so the Radix popovers that open from inside it — the account
   * menu, the date range select — still render above it.
   */
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-white/70 px-6 py-4 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {greeting ? <p className="mt-0.5 text-[13px] text-slate-500">{greeting}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {controls}

          {user?.portal === 'driver' ? null : <NotificationBell />}

          <div className="border-l border-slate-200 pl-3">
            <Menu
              trigger={
                <button
                  type="button"
                  aria-label="Account menu"
                  className="flex items-center gap-2.5 rounded-lg p-1 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                    {initials(organisation)}
                  </span>
                  <span className="hidden text-left leading-tight sm:block">
                    <span className="block text-[13px] font-medium text-slate-800">
                      {organisation}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {user?.portal === 'admin'
                        ? 'Super Admin'
                        : user?.portal === 'driver'
                          ? 'Driver'
                          : 'Ad Account'}
                    </span>
                  </span>
                  <ChevronDown className="hidden size-4 text-slate-400 sm:block" />
                </button>
              }
            >
              <MenuLabel>{user?.email ?? organisation}</MenuLabel>
              <MenuItem icon={UserRound}>Profile</MenuItem>
              <MenuItem icon={Settings}>Account settings</MenuItem>
              <MenuItem icon={LifeBuoy}>Help and support</MenuItem>
              <MenuSeparator />
              <MenuItem icon={LogOut} destructive onSelect={() => void logout()}>
                Sign out
              </MenuItem>
            </Menu>
          </div>
        </div>
      </div>
    </header>
  );
}
