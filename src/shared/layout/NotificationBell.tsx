import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as RMenu from '@radix-ui/react-dropdown-menu';
import { Bell, Megaphone } from 'lucide-react';
import { api } from '@/shared/api/client';
import { useNotifications, type AppNotification } from '@/shared/api/hooks';
import { queryKeys } from '@/shared/api/queryKeys';
import { useAuth } from '@/shared/auth/useAuth';
import { adminPath, type Portal } from '@/shared/auth/portals';
import { formatRelative } from '@/shared/format';
import { cn } from '@/shared/lib/cn';

function kindIcon(kind: AppNotification['kind']) {
  if (kind === 'CAMPAIGN') return Megaphone;
  return Bell;
}

function inboxPath(portal: Portal | undefined): string {
  return portal === 'admin' ? '/v1/admin/notifications' : '/v1/notifications';
}

/**
 * Live inbox on the top bar for both portals.
 *
 * Staff hear about a new campaign; the advertiser hears the approve or reject
 * that follows. Each row belongs to the signed-in user only.
 */
export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const portal = user?.portal;
  const query = useNotifications(Boolean(portal));
  const base = inboxPath(portal);

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`${base}/${id}/read`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.inbox(portal) });
    },
  });

  const markAll = useMutation({
    mutationFn: () => api.post(`${base}/read-all`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.inbox(portal) });
    },
  });

  const unread = query.data?.unreadCount ?? 0;
  const items = query.data?.items ?? [];
  const empty =
    portal === 'admin'
      ? 'Nothing yet. New campaign submissions will appear here.'
      : 'Nothing yet. Updates on your campaigns will appear here.';

  return (
    <RMenu.Root>
      <RMenu.Trigger asChild>
        <button
          type="button"
          className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        >
          <Bell className="size-5" />
          {unread > 0 ? (
            <span className="absolute top-0.5 right-0.5 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </button>
      </RMenu.Trigger>
      <RMenu.Portal>
        <RMenu.Content
          align="end"
          sideOffset={6}
          className="popover-anim z-50 w-[22rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-panel"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3.5 py-2.5">
            <p className="text-[13px] font-semibold text-slate-900">Notifications</p>
            {unread > 0 ? (
              <button
                type="button"
                className="text-[12px] font-medium text-brand-600 hover:text-brand-700"
                onClick={() => markAll.mutate()}
              >
                Mark all read
              </button>
            ) : null}
          </div>

          {items.length === 0 ? (
            <p className="px-3.5 py-8 text-center text-[13px] text-slate-500">{empty}</p>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1">
              {items.map((item) => {
                const Icon = kindIcon(item.kind);
                const unreadRow = item.readAt === null;
                return (
                  <RMenu.Item
                    key={item.id}
                    className={cn(
                      'flex cursor-pointer gap-3 px-3.5 py-2.5 text-left outline-none',
                      'data-[highlighted]:bg-slate-50',
                      unreadRow && 'bg-brand-50/50',
                    )}
                    onSelect={() => {
                      if (unreadRow) markRead.mutate(item.id);
                      if (item.href) {
                        void navigate(portal === 'admin' ? adminPath(item.href) : item.href);
                      }
                    }}
                  >
                    <span
                      className={cn(
                        'mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg',
                        unreadRow ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500',
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-slate-900">
                        {item.title}
                      </span>
                      {item.body ? (
                        <span className="mt-0.5 block text-[12px] text-slate-500">{item.body}</span>
                      ) : null}
                      <span className="mt-1 block text-[11px] text-slate-400">
                        {formatRelative(item.createdAt)}
                      </span>
                    </span>
                    {unreadRow ? (
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-rose-500" />
                    ) : null}
                  </RMenu.Item>
                );
              })}
            </div>
          )}
        </RMenu.Content>
      </RMenu.Portal>
    </RMenu.Root>
  );
}
