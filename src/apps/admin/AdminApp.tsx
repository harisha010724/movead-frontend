import { Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import {
  BadgeCheck,
  Banknote,
  Building2,
  ClipboardCheck,
  LayoutDashboard,
  Megaphone,
  Route as RouteIcon,
  Users,
} from 'lucide-react';
import { AppShell, type NavItem } from '@/shared/layout/AppShell';
import { RequireAuth, RequirePermission } from '@/shared/auth/guards';
import { ADMIN_PERMISSIONS as PERMISSIONS } from '@/shared/auth/permissions';
import { ADMIN_BASE, adminPath, LOGIN_PATH } from '@/shared/auth/portals';
import { FullPageSpinner } from '@/shared/ui';
import { lazyPage } from '@/shared/app/lazyPage';
import { LoginPage } from '@/shared/auth/LoginPage';

const DashboardPage = lazyPage(() => import('./pages/DashboardPage'));
const DriversPage = lazyPage(() => import('./pages/DriversPage'));
const DriverReviewPage = lazyPage(() => import('./pages/DriverReviewPage'));
const VerificationPage = lazyPage(() => import('./pages/VerificationPage'));
const CampaignsPage = lazyPage(() => import('./pages/CampaignsPage'));
const CampaignReviewPage = lazyPage(() => import('./pages/CampaignReviewPage'));
const CampaignCreatePage = lazyPage(() => import('./pages/CampaignCreatePage'));
const GpsAuditPage = lazyPage(() => import('./pages/GpsAuditPage'));
const PayoutsPage = lazyPage(() => import('./pages/PayoutsPage'));
const AdvertisersPage = lazyPage(() => import('./pages/AdvertisersPage'));
const NotFoundPage = lazyPage(() => import('@/shared/pages/NotFoundPage'));

const nav: NavItem[] = [
  { to: adminPath('/'), label: 'Dashboard', icon: LayoutDashboard, end: true },
  {
    to: adminPath('/drivers'),
    label: 'Drivers',
    icon: Users,
    permission: PERMISSIONS.driverRead,
  },
  {
    to: adminPath('/verification'),
    label: 'Verification',
    icon: BadgeCheck,
    permission: PERMISSIONS.documentVerify,
  },
  {
    to: adminPath('/campaign-review'),
    label: 'Campaign production',
    icon: ClipboardCheck,
    permission: PERMISSIONS.campaignRead,
  },
  {
    to: adminPath('/campaigns'),
    label: 'Campaigns',
    icon: Megaphone,
    permission: PERMISSIONS.campaignRead,
    end: true,
  },
  {
    to: adminPath('/gps-audit'),
    label: 'GPS audit',
    icon: RouteIcon,
    permission: PERMISSIONS.tripAudit,
  },
  {
    to: adminPath('/payouts'),
    label: 'Payouts',
    icon: Banknote,
    permission: PERMISSIONS.payoutRun,
  },
  {
    to: adminPath('/advertisers'),
    label: 'Advertisers',
    icon: Building2,
    permission: PERMISSIONS.advertiserRead,
  },
];

export function AdminApp() {
  return (
    <Routes>
      {/*
        In the admin-only bundle this tree is served from the root, so `login`
        here *is* `/login` and renders the page. In the unified app it resolves
        to `/admin/login`, which is now only a redirect kept alive for
        bookmarks — there is one sign-in URL and it is not under `/admin`.
      */}
      <Route
        path="login"
        element={ADMIN_BASE === '' ? <LoginPage /> : <Navigate to={LOGIN_PATH} replace />}
      />

      <Route
        element={
          <RequireAuth>
            <AppShell productName="MoveAd Ops" nav={nav} showSupportCard={false}>
              <Suspense fallback={<FullPageSpinner />}>
                <Outlet />
              </Suspense>
            </AppShell>
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route
          path="drivers"
          element={
            <RequirePermission permission={PERMISSIONS.driverRead}>
              <DriversPage />
            </RequirePermission>
          }
        />
        {/*
          Reading the review screen needs only `driver.read`; the decisions on
          it are gated individually, so a support role could look without being
          able to approve.
        */}
        <Route
          path="drivers/:id"
          element={
            <RequirePermission permission={PERMISSIONS.driverRead}>
              <DriverReviewPage />
            </RequirePermission>
          }
        />
        <Route
          path="verification"
          element={
            <RequirePermission permission={PERMISSIONS.documentVerify}>
              <VerificationPage />
            </RequirePermission>
          }
        />
        <Route
          path="campaign-review"
          element={
            <RequirePermission permission={PERMISSIONS.campaignRead}>
              <CampaignReviewPage />
            </RequirePermission>
          }
        />
        <Route
          path="campaigns"
          element={
            <RequirePermission permission={PERMISSIONS.campaignRead}>
              <CampaignsPage />
            </RequirePermission>
          }
        />
        <Route
          path="campaigns/new"
          element={
            <RequirePermission permission={PERMISSIONS.campaignCreate}>
              <CampaignCreatePage />
            </RequirePermission>
          }
        />
        <Route
          path="gps-audit"
          element={
            <RequirePermission permission={PERMISSIONS.tripAudit}>
              <GpsAuditPage />
            </RequirePermission>
          }
        />
        <Route
          path="payouts"
          element={
            <RequirePermission permission={PERMISSIONS.payoutRun}>
              <PayoutsPage />
            </RequirePermission>
          }
        />
        <Route
          path="advertisers"
          element={
            <RequirePermission permission={PERMISSIONS.advertiserRead}>
              <AdvertisersPage />
            </RequirePermission>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
