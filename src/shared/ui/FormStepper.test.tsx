import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FormStepper } from './FormStepper';

const STEPS = [
  { id: 'details', label: 'Details', hint: 'Name and brand' },
  { id: 'vehicle', label: 'Vehicle', hint: 'City and wrap' },
  { id: 'plan', label: 'Plan' },
] as const;

describe('FormStepper', () => {
  it('names the current step and how far the form has got', () => {
    render(<FormStepper steps={STEPS} current={1} farthest={1} />);

    expect(screen.getByTestId('form-stepper')).toHaveAttribute('data-step', 'vehicle');
    expect(screen.getByTestId('form-stepper')).toHaveAttribute('data-percent', '67');
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vehicle', current: 'step' })).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();
  });

  it('lets the user jump back to a step they have already reached', () => {
    const onSelect = vi.fn();
    render(<FormStepper steps={STEPS} current={2} farthest={2} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it('does not jump ahead of the farthest step they have unlocked', () => {
    const onSelect = vi.fn();
    render(<FormStepper steps={STEPS} current={0} farthest={0} onSelect={onSelect} />);

    expect(screen.getByRole('button', { name: 'Plan' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Plan' }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
