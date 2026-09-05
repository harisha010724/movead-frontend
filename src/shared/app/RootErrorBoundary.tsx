import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { captureError } from '@/shared/lib/monitoring';
import { env } from '@/shared/config/env';

interface State {
  error: Error | null;
}

/**
 * Last line of defence. A render crash inside a billing dashboard should show
 * an honest message rather than a white screen that looks like missing data.
 */
export class RootErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    captureError(error, { componentStack: info.componentStack });
  }

  override render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto w-fit rounded-full bg-red-50 p-3">
            <AlertTriangle className="size-6 text-red-600" />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-slate-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-500">
            The page could not be displayed. The problem has been reported. Reloading usually
            resolves it.
          </p>
          {!env.isProduction && this.state.error.message ? (
            <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-slate-100 p-3 text-left text-xs text-slate-700">
              {this.state.error.message}
            </pre>
          ) : null}
          <Button
            className="mt-6"
            onClick={() => {
              window.location.assign(
                `${window.location.pathname}${window.location.search || ''}`,
              );
            }}
          >
            Reload page
          </Button>
        </div>
      </div>
    );
  }
}
