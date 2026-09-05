import { lazy, type ComponentType } from 'react';

const RELOAD_KEY = 'movead:stale-chunk';

/**
 * Route-level `import()`. After the Vite module graph is rebuilt, the browser
 * can still hold a URL for a chunk that no longer exists. That surfaces as
 * "Failed to fetch dynamically imported module" on the first navigation
 * (login → dashboard). One hard reload is enough; looping is not.
 */
export function lazyPage<T extends object>(
  loader: () => Promise<{ default: ComponentType<T> }>,
) {
  return lazy(async () => {
    try {
      const page = await loader();
      sessionStorage.removeItem(RELOAD_KEY);
      return page;
    } catch (error) {
      const stale =
        error instanceof Error &&
        error.message.includes('Failed to fetch dynamically imported module');

      if (stale && sessionStorage.getItem(RELOAD_KEY) !== '1') {
        sessionStorage.setItem(RELOAD_KEY, '1');
        window.location.reload();
        return new Promise<{ default: ComponentType<T> }>(() => undefined);
      }

      sessionStorage.removeItem(RELOAD_KEY);
      throw error;
    }
  });
}
