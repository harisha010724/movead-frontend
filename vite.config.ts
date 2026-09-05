import { createPortalConfig } from './vite.config.base.js';

/**
 * Local development: both portals on one origin.
 *
 *   http://localhost:5173/login         advertiser
 *   http://localhost:5173/admin/login   operations
 *
 * Production still builds two bundles (vite.advertiser / vite.admin). This
 * config exists so you do not have to run two Vite processes to sign in.
 */
export default createPortalConfig('web', 5173);
