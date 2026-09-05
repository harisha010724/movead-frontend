import { beforeEach, describe, expect, it } from 'vitest';
import { toast, useToastStore } from './toastStore';

const shown = () => useToastStore.getState().toasts;

beforeEach(() => {
  toast.clear();
});

describe('raising a toast', () => {
  it('carries the variant the caller asked for', () => {
    toast.success({ title: 'Vehicle assigned' });
    toast.danger({ title: 'Could not sign you in' });

    expect(shown().map((t) => t.variant)).toEqual(['success', 'danger']);
  });

  it('keeps the description when one is given, and omits it when not', () => {
    toast.info({ title: 'Taken to your dashboard', description: 'Not part of this portal.' });
    toast.info({ title: 'Saved' });

    expect(shown()[0]?.description).toBe('Not part of this portal.');
    expect(shown()[1]?.description).toBeUndefined();
  });

  it('leaves a failure up for longer than a confirmation', () => {
    toast.success({ title: 'Saved' });
    toast.danger({ title: 'Failed' });

    const [success, danger] = shown();
    expect(danger?.duration).toBeGreaterThan(success?.duration ?? 0);
  });

  it('honours an explicit duration, including nought for sticky', () => {
    toast.danger({ title: 'Read this', duration: 0 });
    expect(shown()[0]?.duration).toBe(0);
  });
});

describe('repeat messages', () => {
  /**
   * Three wrong passwords in a row should leave one message on screen. Without
   * a key they stack, and the user reads the same sentence three times.
   */
  it('replaces rather than stacks when a key repeats', () => {
    toast.danger({ key: 'sign-in', title: 'Could not sign you in' });
    toast.danger({ key: 'sign-in', title: 'Could not sign you in' });
    toast.danger({ key: 'sign-in', title: 'Too many attempts' });

    expect(shown()).toHaveLength(1);
    expect(shown()[0]?.title).toBe('Too many attempts');
  });

  it('stacks unrelated messages', () => {
    toast.info({ title: 'One' });
    toast.info({ title: 'Two' });

    expect(shown()).toHaveLength(2);
  });

  it('moves a repeated message to the end, so it is not missed among older ones', () => {
    toast.info({ key: 'a', title: 'A' });
    toast.info({ key: 'b', title: 'B' });
    toast.info({ key: 'a', title: 'A again' });

    expect(shown().map((t) => t.title)).toEqual(['B', 'A again']);
  });
});

describe('dismissing', () => {
  it('removes only the one dismissed', () => {
    toast.info({ key: 'a', title: 'A' });
    toast.info({ key: 'b', title: 'B' });

    toast.dismiss('a');

    expect(shown().map((t) => t.title)).toEqual(['B']);
  });

  it('ignores an id that is no longer showing', () => {
    toast.info({ key: 'a', title: 'A' });
    toast.dismiss('gone');

    expect(shown()).toHaveLength(1);
  });
});
