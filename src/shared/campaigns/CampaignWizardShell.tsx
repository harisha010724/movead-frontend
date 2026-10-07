import type { ReactNode } from 'react';

import { FormStepper, type FormStep } from '@/shared/ui/FormStepper';

/**
 * Three columns: steps on the left, the current form in the middle,
 * live preview on the right. Stacks on small screens.
 */
export function CampaignWizardShell({
  steps,
  current,
  farthest,
  onSelect,
  preview,
  actions,
  children,
}: {
  steps: readonly FormStep[];
  current: number;
  farthest: number;
  onSelect: (index: number) => void;
  preview: ReactNode;
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[16rem_minmax(0,1fr)_22rem]">
      <FormStepper
        steps={steps}
        current={current}
        farthest={farthest}
        onSelect={onSelect}
        className="lg:sticky lg:top-24"
      />
      <div className="min-w-0 space-y-5">
        {children}
        {actions}
      </div>
      <div className="lg:sticky lg:top-24">{preview}</div>
    </div>
  );
}
