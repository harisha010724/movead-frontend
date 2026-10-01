import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bell, Megaphone } from 'lucide-react';

import { api } from '@/shared/api/client';
import {
  useMarkAllNotificationsRead,
  useNotifications,
  type AppNotification,
} from '@/shared/api/hooks';
import { queryKeys } from '@/shared/api/queryKeys';
import { useAuth } from '@/shared/auth/useAuth';
import { PLATFORM_TIMEZONE, formatDate, formatRelative } from '@/shared/format';
import { Page } from '@/shared/layout/Page';
import { cn } from '@/shared/lib/cn';
import {
  Card,
  CardBody,
  EmptyState,
  QueryBoundary,
  Skeleton,
  Tab,
  TabList,
  Tabs,
} from '@/shared/ui';

type Filter = 'all' | 'unread' | 'campaign';

function kindIcon(item: AppNotification) {
  if (isAlert(item)) return AlertTriangle;
  if (item.kind === 'CAMPAIGN') return Megaphone;
  return Bell;
}

function isAlert(item: AppNotification): boolean {
  return /not approved|paused|stopped|budget|needs attention|wrap needs/i.test(
    `${item.title} ${item.body ?? ''}`,
  );
}

function dayKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PLATFORM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function todayKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PLATFORM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function groupLabel(day: string): string {
  if (day === todayKey()) return 'Today';
  return formatDate(`${day}T00:00:00+05:30`);
}

function NotificationsSkeleton() {
  return (
    <Card aria-busy="true" aria-label="Loading notifications">
      <CardBody className="space-y-3">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex gap-3 py-2">
            <Skeleton className="size-8 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

export default function NotificationsPage() {
  const query = useNotifications();
  const markAll = useMarkAllNotificationsRead();

  useEffect(() => {
    if ((query.data?.unreadCount ?? 0) > 0 && !markAll.isPending) markAll.mutate();
    // Opening the inbox is what clears the badge (AC-36.4). Keyed on unread
    // only — the mutation object changing every render would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data?.unreadCount]);

  return (
    <Page title="Notifications" greeting="What happened to your campaigns, in the order it happened">
      <QueryBoundary
        query={query}
        loading={<NotificationsSkeleton />}
        errorTitle="Could not load notifications"
      >
        {(inbox) => <Inbox items={inbox.items} />}
      </QueryBoundary>
    </Page>
  );
}

function Inbox({ items }: { items: AppNotification[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/v1/notifications/${id}/read`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.inbox(user?.portal),
      });
    },
  });

  const unreadCount = items.filter((item) => item.readAt === null).length;
  const visible = items.filter((item) => {
    if (filter === 'unread') return item.readAt === null;
    if (filter === 'campaign') return item.kind === 'CAMPAIGN';
    return true;
  });

  const groups = useMemo(() => {
    const byDay = new Map<string, AppNotification[]>();
    for (const item of visible) {
      const day = dayKey(item.createdAt);
      const list = byDay.get(day) ?? [];
      list.push(item);
      byDay.set(day, list);
    }
    return [...byDay.entries()];
  }, [visible]);

  return (
    <div className="space-y-5">
      <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
        <TabList label="Notification filters">
          <Tab value="all" count={items.length}>
            All
          </Tab>
          <Tab value="unread" count={unreadCount}>
            Unread
          </Tab>
          <Tab value="campaign" count={items.filter((item) => item.kind === 'CAMPAIGN').length}>
            Campaign
          </Tab>
        </TabList>
      </Tabs>

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={Bell}
            title={items.length === 0 ? 'Nothing yet' : 'Nothing in this filter'}
            description={
              items.length === 0
                ? 'Updates on your campaigns appear here — submit, review, wraps and budget.'
                : 'Switch to All to see the rest of the inbox.'
            }
          />
        </Card>
      ) : (
        <Card>
          <CardBody className="space-y-6">
            {groups.map(([day, rows]) => (
              <section key={day}>
                <h2 className="mb-2 text-[12px] font-semibold tracking-wide text-slate-500 uppercase">
                  {groupLabel(day)}
                </h2>
                <ul className="divide-y divide-slate-100">
                  {rows.map((item) => {
                    const Icon = kindIcon(item);
                    const unread = item.readAt === null;
                    const alert = isAlert(item);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={cn(
                            'flex w-full gap-3 px-1 py-3 text-left',
                            unread && 'bg-brand-50/40',
                          )}
                          onClick={() => {
                            if (unread) markRead.mutate(item.id);
                            if (item.href) navigate(item.href);
                          }}
                        >
                          <span
                            className={cn(
                              'mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg',
                              alert
                                ? 'bg-rose-100 text-rose-700'
                                : unread
                                  ? 'bg-brand-100 text-brand-700'
                                  : 'bg-slate-100 text-slate-500',
                            )}
                          >
                            <Icon className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-medium text-slate-900">
                              {item.title}
                            </span>
                            {item.body ? (
                              <span className="mt-0.5 block text-[13px] text-slate-500">
                                {item.body}
                              </span>
                            ) : null}
                            <span className="mt-1 block text-[11px] text-slate-400">
                              {formatRelative(item.createdAt)}
                            </span>
                          </span>
                          {unread ? (
                            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-rose-500" />
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
