import { Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Home, Megaphone, Navigation, User, Wallet } from 'lucide-react';
import { AppShell, type NavItem } from '@/shared/layout/AppShell';
import { RequireAuth } from '@/shared/auth/guards';
import { FullPageSpinner } from '@/shared/ui';
import { lazyPage } from '@/shared/app/lazyPage';
import { LOGIN_PATH } from '@/shared/auth/portals';

const AcceptInvitationPage = lazyPage(
  () => import('@/apps/advertiser/pages/AcceptInvitationPage'),
);

const DashboardPage = lazyPage(() => import('./pages/DashboardPage'));
const EarningsPage = lazyPage(() => import('./pages/EarningsPage'));
const TrackPage = lazyPage(() => import('./pages/TrackPage'));
const CampaignPage = lazyPage(() => import('./pages/CampaignPage'));
const ProfilePage = lazyPage(() => import('./pages/ProfilePage'));

const nav: NavItem[] = [
  { to: '/driver', label: 'Home', icon: Home, end: true },
  { to: '/driver/earnings', label: 'Earnings', icon: Wallet },
  { to: '/driver/track', label: 'Track', icon: Navigation },
  { to: '/driver/campaign', label: 'Campaigns', icon: Megaphone },
  { to: '/driver/profile', label: 'Profile', icon: User },
];

/**
 * Driver web portal. Same five sections as the mobile app (UI-001). Tracking
 * itself still happens on the phone — the browser can show status and money.
 */
export function DriverApp() {
  return (
    <Routes>
      {/* Kept for bookmarks only; drivers sign in at the one shared `/login`. */}
      <Route path="login" element={<Navigate to={LOGIN_PATH} replace />} />
      <Route
        path="invitation/:token"
        element={
          <Suspense fallback={<FullPageSpinner />}>
            <AcceptInvitationPage />
          </Suspense>
        }
      />

      <Route
        element={
          <RequireAuth>
            <AppShell productName="MoveAd Driver" nav={nav} showSupportCard={false}>
              <Suspense fallback={<FullPageSpinner />}>
                <Outlet />
              </Suspense>
            </AppShell>
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="earnings" element={<EarningsPage />} />
        <Route path="track" element={<TrackPage />} />
        <Route path="campaign" element={<CampaignPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/driver" replace />} />
      </Route>
    </Routes>
  );
}
