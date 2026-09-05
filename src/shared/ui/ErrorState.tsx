import { AlertTriangle, RefreshCw } from 'lucide-react';
import { ApiError } from '@/shared/api/errors';
import { toDisplayMessage } from '@/shared/api/errors';
import { Button } from './Button';

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}

/**
 * WEB-008: an error state must say what failed and offer a way forward.
 * The request id is shown when present so a user can quote it to support and
 * the exact request can be found in the logs.
 */
export function ErrorState({ error, onRetry, title = 'Could not load this' }: ErrorStateProps) {
  const apiError = error instanceof ApiError ? error : null;
  const canRetry = onRetry && (apiError?.isRetryable ?? true);

  return (
    <div
      className="flex flex-col items-center justify-center px-6 py-14 text-center"
      role="alert"
    >
      <div className="rounded-full bg-red-50 p-3">
        <AlertTriangle className="size-6 text-red-600" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-slate-500">{toDisplayMessage(error)}</p>

      {apiError?.requestId ? (
        <p className="mt-2 font-mono text-xs text-slate-400">Reference: {apiError.requestId}</p>
      ) : null}

      {canRetry ? (
        <Button
          variant="secondary"
          className="mt-5"
          onClick={onRetry}
          leadingIcon={<RefreshCw className="size-4" />}
        >
          Try again
        </Button>
      ) : null}
    </div>
  );
}
