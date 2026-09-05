import { fileURLToPath, URL } from 'node:url';
// Imported from vitest/config rather than vite so the `test` block is typed.
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export type PortalName = 'advertiser' | 'admin' | 'web';

/**
 * Both portals share tooling but build to separate bundles served from separate
 * origins, so admin code is never shipped to an advertiser's browser (WEB-001).
 *
 * `web` is the local-dev exception: one origin, `/admin/*` for operations and
 * the rest for advertisers, so you do not run two Vite processes to sign in.
 */
export function createPortalConfig(portal: PortalName, devPort: number) {
  const resolvePath = (p: string) => fileURLToPath(new URL(p, import.meta.url));
  const envDir = resolvePath('.');

  return defineConfig(({ mode }) => {
    /**
     * Read explicitly, because Vite does not copy `.env` onto `process.env` —
     * only onto `import.meta.env`, which the config file is not. Reading
     * `process.env` here silently ignored the value in `.env.local` and used
     * the fallback instead, which went unnoticed for as long as the mock
     * answered every request and the proxy was never exercised.
     *
     * `process.env` still wins where it is set, so CI can override without
     * writing a file.
     */
    const env = loadEnv(mode, envDir, 'VITE_');
    const apiTarget =
      process.env.VITE_API_PROXY_TARGET ?? env.VITE_API_PROXY_TARGET ?? 'http://localhost:8080';

    return {
      root: resolvePath(`./src/apps/${portal}`),
      publicDir: resolvePath('./public'),
      envDir,
      plugins: [react(), tailwindcss()],
      resolve: {
        alias: {
          '@': resolvePath('./src'),
        },
      },
      define: {
        // The unified dev app is not an advertiser build; it just isn't the
        // admin-only bundle, which is what `adminPath` keys off.
        __PORTAL__: JSON.stringify(portal === 'admin' ? 'admin' : 'advertiser'),
      },
      server: {
        port: devPort,
        strictPort: true,
        // IPv4 as well as IPv6. Binding only [::1] makes 127.0.0.1 fail, and
        // a stale tab after a restart then dies on the dashboard's lazy chunk.
        host: true,
        proxy: {
          // Keeps the browser same-origin in development so httpOnly auth
          // cookies behave exactly as they do in production.
          '/api': {
            target: apiTarget,
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
            configure: (proxy) => {
              // Otherwise an API that is simply not running shows up in the
              // browser as a bare 502 with nothing in the terminal.
              proxy.on('error', (error: Error) => {
                console.error(`[proxy] ${apiTarget} unreachable: ${error.message}`);
              });
            },
          },
        },
      },
      build: {
        outDir: resolvePath(`./dist/${portal}`),
        emptyOutDir: true,
        sourcemap: true,
        rollupOptions: {
          output: {
            // Long-lived vendor chunks: these change far less often than app
            // code, so keeping them separate preserves cache hits on deploy.
            manualChunks(id) {
              if (!id.includes('node_modules')) return undefined;
              if (/[\\/]node_modules[\\/](react|react-dom|react-router)/.test(id)) return 'react';
              if (id.includes('@tanstack')) return 'query';
              return undefined;
            },
          },
        },
      },
      test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: [resolvePath('./src/test/setup.ts')],
        include: [resolvePath('./src/**/*.test.{ts,tsx}')],
      },
    };
  });
}
