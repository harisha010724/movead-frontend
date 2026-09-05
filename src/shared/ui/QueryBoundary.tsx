import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { ErrorState } from './ErrorState';
import { EmptyState } from './EmptyState';
import { Spinner } from './Spinner';

interface QueryBoundaryProps<T> {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  /** Prefer a shaped skeleton over a spinner wherever the layout is known. */
  loading?: ReactNode;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  errorTitle?: string;
}

/**
 * WEB-008 in one place: every data-backed view renders a loading, empty, error
 * or success state, and never a half-rendered panel.
 *
 * Note this deliberately keeps showing data while a background refetch is in
 * flight — flashing a skeleton every ten seconds on the live map would be
 * worse than a briefly stale number.
 */
export function QueryBoundary<T>({
  query,
  children,
  loading,
  isEmpty,
  empty,
  errorTitle,
}: QueryBoundaryProps<T>) {
  if (query.isPending) {
    return (
      <>
        {loading ?? (
          <div className="flex justify-center py-14" role="status" aria-live="polite">
            <Spinner />
            <span className="sr-only">Loading</span>
          </div>
        )}
      </>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        onRetry={() => void query.refetch()}
        {...(errorTitle ? { title: errorTitle } : {})}
      />
    );
  }

  const data = query.data;

  if (isEmpty?.(data)) {
    return <>{empty ?? <EmptyState title="Nothing to show yet" />}</>;
  }

  return <>{children(data)}</>;
}
