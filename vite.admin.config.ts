import { createPortalConfig } from './vite.config.base.js';

// Production-shaped preview of the admin-only bundle (WEB-001). Local work
// uses vite.config.ts on 5173 with /admin/* instead.
export default createPortalConfig('admin', 5174);
