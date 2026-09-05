import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { useAuth } from './useAuth';
import type { Permission } from './permissions';
import { currentWebPortal, LOGIN_PATH, portalLabel, portalPath } from './portals';
import { FullPageSpinner } from '@/shared/ui/Spinner';
import { EmptyState } from '@/shared/ui/EmptyState';
import { toast } from '@/shared/ui/toast';

/** Redirects to login, preserving where the user was heading. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  const here = __PORTAL__ === 'admin' ? 'admin' : currentWebPortal(location.pathname);

  // Signed in, but to a different product than this URL belongs to. Silently
  // moving them looks like the app losing their click, so say what happened.
  const wrongPortal = !isLoading && isAuthenticated && user && user.portal !== here;

  useEffect(() => {
    if (!wrongPortal || !user) return;
    toast.warning({
      key: 'portal-mismatch',
      title: `That page is part of the ${portalLabel(here)} portal`,
      description: `You are signed in to the ${portalLabel(user.portal)} portal, so we brought you back to your dashboard.`,
    });
  }, [wrongPortal, user, here]);

  if (isLoading) return <FullPageSpinner label="Checking your session" />;

  if (!isAuthenticated) {
    return (
      <Navigate to={LOGIN_PATH} replace state={{ from: location.pathname + location.search }} />
    );
  }

  if (wrongPortal && user) {
    return <Navigate to={portalPath(user.portal)} replace />;
  }

  return <>{children}</>;
}

/**
 * Hides a route the user cannot access.
 *
 * This is presentation only. The same permission is enforced server-side on
 * every request, so a user who navigates here directly still gets a 403.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const { can } = useAuth();

  if (!can(permission)) {
    return (
      <EmptyState
        icon={ShieldOff}
        title="You do not have access to this page"
        description="Ask an administrator if you believe you should be able to see it."
      />
    );
  }

  return <>{children}</>;
}

/** Conditionally renders an action the user is permitted to take. */
export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can } = useAuth();
  return <>{can(permission) ? children : fallback}</>;
}
