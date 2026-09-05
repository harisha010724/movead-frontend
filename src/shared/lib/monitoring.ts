import * as Sentry from '@sentry/react';
import { env } from '@/shared/config/env';

export function initMonitoring(): void {
  if (!env.sentryDsn) return;

  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.appEnv,
    // Distinguishes advertiser errors from admin errors at a glance.
    initialScope: { tags: { portal: env.portal } },
    tracesSampleRate: env.isProduction ? 0.1 : 1.0,
    sendDefaultPii: false,
    beforeSend(event) {
      // Never let a driver's or advertiser's identifiers reach the error tracker.
      if (event.request?.cookies) delete event.request.cookies;
      return event;
    },
  });
}

export const captureError = (error: unknown, context?: Record<string, unknown>) => {
  if (env.sentryDsn) Sentry.captureException(error, context ? { extra: context } : undefined);
  else console.error(error, context);
};
