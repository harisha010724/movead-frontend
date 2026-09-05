import { create } from 'zustand';

/**
 * Matches `Badge`'s tone vocabulary so the same word means the same colour
 * wherever it appears.
 */
export type ToastVariant = 'info' | 'success' | 'warning' | 'danger';

export interface ToastOptions {
  /** One line, sentence case, no full stop. Say what happened. */
  title: string;
  /** Optional second line: why, or what to do about it. */
  description?: string;
  variant?: ToastVariant;
  /** Milliseconds on screen. `0` keeps it up until dismissed. */
  duration?: number;
  /**
   * Supplying one replaces the toast already showing under that key instead of
   * stacking a duplicate. Three failed sign-ins should leave one message, not
   * three identical ones.
   */
  key?: string;
}

export interface ToastRecord {
  id: string;
  title: string;
  description: string | undefined;
  variant: ToastVariant;
  duration: number;
}

/**
 * A failure has to survive being read. Successes are confirmations of something
 * the user just watched happen, so they can leave sooner.
 */
const DURATIONS: Record<ToastVariant, number> = {
  info: 5000,
  success: 4000,
  warning: 7000,
  danger: 8000,
};

interface ToastState {
  toasts: ToastRecord[];
  push: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

let counter = 0;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],

  push: (options) => {
    const variant = options.variant ?? 'info';
    const id = options.key ?? `toast-${String(++counter)}`;
    const record: ToastRecord = {
      id,
      title: options.title,
      description: options.description,
      variant,
      duration: options.duration ?? DURATIONS[variant],
    };

    set((state) => ({
      toasts: [...state.toasts.filter((t) => t.id !== id), record],
    }));

    return id;
  },

  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  clear: () => set({ toasts: [] }),
}));

function push(options: ToastOptions): string {
  return useToastStore.getState().push(options);
}

/**
 * Imperative, and deliberately not a hook: the callers that need it most are
 * effects and mutation callbacks, and some of them (a redirect guard, an API
 * error handler) are not in a position to hold one.
 *
 * Toasts are for things the user did not ask to read — a background failure, a
 * redirect they did not expect. Field validation belongs under the field, where
 * `FormError` and `TextField` put it.
 */
export const toast = {
  show: push,
  info: (options: Omit<ToastOptions, 'variant'>) => push({ ...options, variant: 'info' }),
  success: (options: Omit<ToastOptions, 'variant'>) => push({ ...options, variant: 'success' }),
  warning: (options: Omit<ToastOptions, 'variant'>) => push({ ...options, variant: 'warning' }),
  danger: (options: Omit<ToastOptions, 'variant'>) => push({ ...options, variant: 'danger' }),
  dismiss: (id: string) => {
    useToastStore.getState().dismiss(id);
  },
  clear: () => {
    useToastStore.getState().clear();
  },
};
