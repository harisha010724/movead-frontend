import { createContext } from 'react';
import type { Permission } from './permissions';
import type { Portal } from './portals';

/**
 * The signed-in user. Same fields as the `user` object on a successful
 * `POST /v1/auth/login` (and on `GET /v1/auth/me` when restoring a session).
 *
 * The API calls the portal an "audience". Here it is `portal`, which is the
 * same fact under the name the rest of this codebase uses.
 */
export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  portal: Portal;
  /** Null for platform staff and drivers; set for advertiser-portal users. */
  advertiserId: string | null;
  /** Null for platform staff and advertisers; set for driver-portal users. */
  driverId: string | null;
  organisationName: string;
  roles: string[];
  permissions: string[];
  mfaEnabled: boolean;
  lastLoginAt: string | null;
}

/** Wire shape: login, MFA verify, and `/me` all use `audience`. */
export type AuthUserPayload = Omit<CurrentUser, 'portal'> & { audience: Portal };

export function toCurrentUser(payload: AuthUserPayload): CurrentUser {
  const { audience, ...rest } = payload;
  return { ...rest, portal: audience };
}

export interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  can: (permission: Permission) => boolean;
  logout: () => Promise<void>;
}

/** Kept out of AuthProvider.tsx so that file only exports components. */
export const AuthContext = createContext<AuthContextValue | null>(null);
