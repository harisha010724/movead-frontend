import { Suspense } from 'react';
import { Outlet, Route, Routes } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  CreditCard,
  Eye,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Radio,
  Settings,
  Truck,
} from 'lucide-react';
import { AppShell, type NavItem } from '@/shared/layout/AppShell';
import { RequireAuth, RequirePermission } from '@/shared/auth/guards';
import { ADVERTISER_PERMISSIONS as PERMISSIONS } from '@/shared/auth/permissions';
import { FullPageSpinner } from '@/shared/ui';
import { lazyPage } from '@/shared/app/lazyPage';
import { LoginPage } from '@/shared/auth/LoginPage';

// Route-level code splitting keeps the initial dashboard bundle small; the
// heavier map and report screens load only when opened.
const AcceptInvitationPage = lazyPage(() => import('./pages/AcceptInvitationPage'));
const DashboardPage = lazyPage(() => import('./pages/DashboardPage'));
const CampaignsPage = lazyPage(() => import('./pages/CampaignsPage'));
const CampaignCreatePage = lazyPage(() => import('./pages/CampaignCreatePage'));
const LiveTrackingPage = lazyPage(() => import('./pages/LiveTrackingPage'));
const VehiclesPage = lazyPage(() => import('./pages/VehiclesPage'));
const ReportsPage = lazyPage(() => import('./pages/ReportsPage'));
const BillingPage = lazyPage(() => import('./pages/BillingPage'));
const PlaceholderPage = lazyPage(() => import('@/shared/pages/PlaceholderPage'));
const NotFoundPage = lazyPage(() => import('@/shared/pages/NotFoundPage'));

const nav: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  {
    to: '/campaigns',
    label: 'Campaigns',
    icon: Megaphone,
    permission: PERMISSIONS.campaignRead,
  },
  {
    to: '/vehicles',
    label: 'Vehicles',
    icon: Truck,
    permission: PERMISSIONS.vehicleRead,
    children: [
      { to: '/vehicles', label: 'All Vehicles' },
      { to: '/vehicles/performance', label: 'Performance' },
    ],
  },
  {
    to: '/tracking',
    label: 'Live Tracking',
    icon: Radio,
    permission: PERMISSIONS.trackingRead,
  },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, permission: PERMISSIONS.reportRead },
  {
    to: '/impressions',
    label: 'Impressions',
    icon: Eye,
    permission: PERMISSIONS.reportRead,
    children: [
      { to: '/impressions/by-area', label: 'By Area' },
      { to: '/impressions/by-vehicle', label: 'By Vehicle Type' },
    ],
  },
  { to: '/reports', label: 'Reports', icon: FileText, permission: PERMISSIONS.reportRead },
  {
    to: '/billing',
    label: 'Billing & Payments',
    icon: CreditCard,
    permission: PERMISSIONS.walletRead,
  },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/support', label: 'Support', icon: LifeBuoy },
];

export function AdvertiserApp() {
  return (
    <Routes>
      {/*
        `/login` for every audience, not just this one. The advertiser tree is
        what serves `/` in both the unified app and the advertiser bundle, so
        the shared sign-in page hangs here; admins and drivers who sign in are
        sent to their own product afterwards.
      */}
      <Route path="login" element={<LoginPage />} />

      {/*
        Outside RequireAuth, and it has to be: whoever follows an invitation has
        no password yet, so a guard here would redirect them to the sign-in page
        they cannot use.
      */}
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
            <AppShell productName="MoveAd" nav={nav}>
              <Suspense fallback={<FullPageSpinner />}>
                <Outlet />
              </Suspense>
            </AppShell>
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
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
          path="campaigns/:campaignId/edit"
          element={
            <RequirePermission permission={PERMISSIONS.campaignCreate}>
              <CampaignCreatePage />
            </RequirePermission>
          }
        />
        <Route
          path="tracking"
          element={
            <RequirePermission permission={PERMISSIONS.trackingRead}>
              <LiveTrackingPage />
            </RequirePermission>
          }
        />
        <Route
          path="vehicles"
          element={
            <RequirePermission permission={PERMISSIONS.vehicleRead}>
              <VehiclesPage />
            </RequirePermission>
          }
        />
        <Route
          path="reports"
          element={
            <RequirePermission permission={PERMISSIONS.reportRead}>
              <ReportsPage />
            </RequirePermission>
          }
        />
        <Route
          path="billing"
          element={
            <RequirePermission permission={PERMISSIONS.walletRead}>
              <BillingPage />
            </RequirePermission>
          }
        />

        {/* Routes the design's sidebar links to, not yet built out. */}
        <Route
          path="vehicles/performance"
          element={<PlaceholderPage title="Vehicle Performance" />}
        />
        <Route path="analytics" element={<PlaceholderPage title="Analytics" />} />
        <Route
          path="impressions/by-area"
          element={<PlaceholderPage title="Impressions by Area" />}
        />
        <Route
          path="impressions/by-vehicle"
          element={<PlaceholderPage title="Impressions by Vehicle Type" />}
        />
        <Route path="notifications" element={<PlaceholderPage title="Notifications" />} />
        <Route path="settings" element={<PlaceholderPage title="Settings" />} />
        <Route path="support" element={<PlaceholderPage title="Support" />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
