import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const resolvePath = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Tests run against the shared source, not against a portal build, so a single
 * config covers both apps. Portal-specific behaviour is injected through
 * `__PORTAL__`, which is stubbed here.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolvePath('./src') },
  },
  define: {
    __PORTAL__: JSON.stringify('advertiser'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
