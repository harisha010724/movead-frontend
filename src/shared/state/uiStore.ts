import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { env } from '@/shared/config/env';

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

/**
 * Local UI preferences only.
 *
 * Server data belongs in React Query; putting it here means two caches that
 * disagree. Nothing in this store should ever need to be correct.
 */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    }),
    { name: `movead:${env.portal}:ui` },
  ),
);
