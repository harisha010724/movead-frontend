/// <reference types="vite/client" />

declare const __PORTAL__: 'advertiser' | 'admin';

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  /** Origins of the two portals. Both bundles need both, for the shared login. */
  readonly VITE_ADVERTISER_URL: string;
  readonly VITE_ADMIN_URL: string;
  readonly VITE_APP_ENV: 'local' | 'staging' | 'production';
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  /** `true`, `false`, or a comma-separated list of portals using the mock. */
  readonly VITE_USE_MOCK_API?: string;
  /** Mirrors the backend flag. Only the mock reads it; the real server decides. */
  readonly VITE_ADMIN_MFA_REQUIRED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
