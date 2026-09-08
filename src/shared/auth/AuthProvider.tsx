import { useCallback, useMemo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { queryKeys } from '@/shared/api/queryKeys';
import { freshness } from '@/shared/api/queryClient';
import { ApiError } from '@/shared/api/errors';
import { hasPermission } from './permissions';
import {
  AuthContext,
  toCurrentUser,
  type AuthContextValue,
  type AuthUserPayload,
  type CurrentUser,
} from './authContext';
import { currentWebPortal } from './portals';
import { isPublicAuthPath } from './session';
import { clearAllSessionTokens } from './sessionToken';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  const restoreSession = !isPublicAuthPath(pathname);
  const sessionPortal = __PORTAL__ === 'admin' ? 'admin' : currentWebPortal(pathname);

  // On a protected page, the cookie is httpOnly, so the only way to know who
  // is signed in after a reload is to ask. Login already returned the user, so
  // the sign-in pages do not probe — a 401 there is just "not signed in yet".
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.auth.me(sessionPortal),
    queryFn: async (): Promise<CurrentUser> => {
      const payload = await api.get<AuthUserPayload>('/v1/auth/me');
      return toCurrentUser(payload);
    },
    ...freshness.reference,
    enabled: restoreSession,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.isUnauthenticated) return false;
      return failureCount < 1;
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.post<void>('/v1/auth/logout'),
    // `onSettled`, so a sign-out whose request failed still signs you out
    // locally. A token kept because the server could not be reached is a
    // browser that looks signed in and cannot be signed out.
    onSettled: () => {
      clearAllSessionTokens();
      // Clear everything: cached data belongs to the session that just ended.
      queryClient.clear();
    },
  });

  const user = data ?? null;
  const { mutateAsync: performLogout } = logoutMutation;

  const can = useCallback(
    (permission: Parameters<AuthContextValue['can']>[0]) =>
      user ? hasPermission(user.permissions, permission) : false,
    [user],
  );

  const logout = useCallback(async () => {
    await performLogout();
  }, [performLogout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      can,
      logout,
    }),
    [user, isLoading, can, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
