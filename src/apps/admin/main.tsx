import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from '@/shared/app/AppProviders';
import { initMonitoring } from '@/shared/lib/monitoring';
import { AdminApp } from './AdminApp';
import '@/styles/index.css';

initMonitoring();

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <AdminApp />
    </AppProviders>
  </StrictMode>,
);
