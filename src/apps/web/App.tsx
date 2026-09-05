import { Route, Routes } from 'react-router-dom';
import { AdminApp } from '@/apps/admin/AdminApp';
import { AdvertiserApp } from '@/apps/advertiser/AdvertiserApp';
import { DriverApp } from '@/apps/driver/DriverApp';

/**
 * One origin, three products.
 *
 * `/admin/*` operations, `/driver/*` the driver portal, everything else the
 * advertiser portal. The account's audience from sign-in picks the dashboard.
 */
export function App() {
  return (
    <Routes>
      <Route path="/admin/*" element={<AdminApp />} />
      <Route path="/driver/*" element={<DriverApp />} />
      <Route path="/*" element={<AdvertiserApp />} />
    </Routes>
  );
}
