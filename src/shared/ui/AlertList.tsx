import { cn } from '@/shared/lib/cn';
import { formatTime } from '@/shared/format';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertItem {
  id: string;
  severity: AlertSeverity;
  message: string;
  occurredAt: string;
}

const dots: Record<AlertSeverity, string> = {
  info: 'bg-emerald-500',
  warning: 'bg-amber-500',
  critical: 'bg-rose-500',
};

export function AlertList({ alerts }: { alerts: AlertItem[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {alerts.map((alert) => (
        <li key={alert.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
          <span
            className={cn('mt-1.5 size-2 shrink-0 rounded-full', dots[alert.severity])}
            aria-hidden
          />
          <p className="min-w-0 flex-1 text-[13px] text-slate-700">{alert.message}</p>
          <time
            dateTime={alert.occurredAt}
            className="numeric shrink-0 text-[11px] whitespace-nowrap text-slate-400"
          >
            {formatTime(alert.occurredAt)}
          </time>
        </li>
      ))}
    </ul>
  );
}
