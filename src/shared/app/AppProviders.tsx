import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter } from 'react-router-dom';
import { createQueryClient } from '@/shared/api/queryClient';
import { AuthProvider } from '@/shared/auth/AuthProvider';
import { Toaster, TooltipProvider } from '@/shared/ui';
import { RootErrorBoundary } from './RootErrorBoundary';
import { env } from '@/shared/config/env';

export function AppProviders({ children }: { children: ReactNode }) {
  // Created in state so a hot reload does not discard the cache, and so each
  // test gets an isolated client.
  const [queryClient] = useState(createQueryClient);

  return (
    <RootErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <TooltipProvider>
              {children}
              {/*
                Inside the router: a guard that redirects can only say why it
                did if the toast outlives the route it was raised from.
              */}
              <Toaster />
            </TooltipProvider>
          </AuthProvider>
        </BrowserRouter>
        {!env.isProduction ? <ReactQueryDevtools initialIsOpen={false} /> : null}
      </QueryClientProvider>
    </RootErrorBoundary>
  );
}
