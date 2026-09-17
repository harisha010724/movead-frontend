import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toaster } from './Toaster';
import { toast } from './toastStore';

afterEach(() => {
  toast.clear();
  vi.restoreAllMocks();
});

/**
 * Radix settles a new toast over a frame or two — a presence transition and a
 * dismissable layer subscription — none of which React attributes to the call
 * that started them. Awaiting an empty act lets those land inside one.
 */
async function raise(run: () => void) {
  await act(async () => {
    run();
    await Promise.resolve();
  });
}

describe('the countdown bar', () => {
  it('runs for exactly as long as the toast is up', async () => {
    render(<Toaster />);
    await raise(() => toast.info({ title: 'Saved', duration: 4000 }));

    expect(screen.getByTestId('toast-progress')).toHaveStyle({ animationDuration: '4000ms' });
  });

  /**
   * A failure stays up longer than a confirmation. The bar reads the same
   * duration the toast does, so the two cannot disagree on screen.
   */
  it('takes its length from the variant when none is given', async () => {
    render(<Toaster />);
    await raise(() => toast.danger({ title: 'Could not save' }));

    expect(screen.getByTestId('toast-progress')).toHaveStyle({ animationDuration: '8000ms' });
  });

  it('is absent on a toast that waits to be dismissed', async () => {
    render(<Toaster />);
    await raise(() => toast.danger({ title: 'Read this', duration: 0 }));

    expect(screen.getByText('Read this')).toBeInTheDocument();
    expect(screen.queryByTestId('toast-progress')).not.toBeInTheDocument();
  });
});

describe('pausing', () => {
  /**
   * Radix stops its timers when the window goes to the background. The bar is
   * CSS and would otherwise keep draining, so the viewport carries the flag
   * the stylesheet pauses on.
   *
   * The flag is read from `document.hasFocus()` on each focus event rather
   * than tracked from the events alone, so that is what the test moves. jsdom
   * reports a window that is never focused and does not answer differently
   * for a dispatched event.
   */
  it('marks the stack paused while the window is elsewhere', async () => {
    const hasFocus = vi.spyOn(document, 'hasFocus').mockReturnValue(true);

    const { baseElement } = render(<Toaster />);
    await raise(() => toast.info({ title: 'Saved' }));

    const viewport = baseElement.querySelector('.toast-viewport');
    expect(viewport).not.toHaveAttribute('data-paused');

    hasFocus.mockReturnValue(false);
    await raise(() => window.dispatchEvent(new Event('blur')));
    expect(viewport).toHaveAttribute('data-paused');

    hasFocus.mockReturnValue(true);
    await raise(() => window.dispatchEvent(new Event('focus')));
    expect(viewport).not.toHaveAttribute('data-paused');
  });
});
