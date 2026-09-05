import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CirclePause, CirclePlay, OctagonX } from 'lucide-react';
import { z } from 'zod';
import { api } from '@/shared/api/client';
import { toDisplayMessage } from '@/shared/api/errors';
import { queryKeys } from '@/shared/api/queryKeys';
import { VALIDATION_MODE } from '@/shared/lib/formConfig';
import type { AdminCampaign } from '@/shared/types/domain';
import { Button, Dialog } from '@/shared/ui';
import { FormError, TextareaField } from '@/shared/ui/form';

export type CampaignAction = 'pause' | 'resume' | 'complete' | 'stop';

const schema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, 'Give a reason the advertiser and the drivers can act on')
    .max(500, 'Reason must be 500 characters or fewer'),
});

type Values = z.infer<typeof schema>;

interface Action {
  title: string;
  /** What this does to the people it happens to, not what it does to a row. */
  describe: (campaign: AdminCampaign) => string;
  confirm: string;
  icon: typeof CirclePause;
  variant?: 'danger';
  /** Halting a running campaign costs somebody money; it is not a bare button. */
  needsReason?: boolean;
  hint?: string;
}

const ACTIONS: Record<CampaignAction, Action> = {
  pause: {
    title: 'Pause campaign',
    describe: (c) =>
      `Kilometres stop being billed on ${c.name} and its drivers stop being able to track. The wraps stay on and the vehicles stay assigned, so the same fleet resumes.`,
    confirm: 'Pause campaign',
    icon: CirclePause,
    needsReason: true,
    hint: 'The advertiser is told this word for word. Drivers are told their kilometres have stopped counting.',
  },
  resume: {
    title: 'Resume campaign',
    describe: (c) =>
      `${c.name} starts billing again on the vehicles already carrying it, and its drivers can track from now.`,
    confirm: 'Resume campaign',
    icon: CirclePlay,
  },
  complete: {
    title: 'Complete campaign',
    describe: (c) =>
      `${c.name} has run its course. Every vehicle is released and can be sold to the next advertiser. Spend and driver earnings already recorded are untouched.`,
    confirm: 'Complete campaign',
    icon: CheckCircle2,
  },
  stop: {
    title: 'Stop campaign',
    describe: (c) =>
      `${c.name} ends before its end date and every vehicle is released. Use this when the flight is being cut short — completing is for one that finished.`,
    confirm: 'Stop campaign',
    icon: OctagonX,
    variant: 'danger',
    needsReason: true,
    hint: 'Kept apart from completing so a report can say why a campaign underdelivered.',
  },
};

/**
 * The four things operations can do to a campaign that is already on the road
 * (AC-34.10).
 *
 * One dialog rather than four near-identical ones, for the same reason the
 * server has one transition rather than eight copies: what differs between
 * them is wording and whether a reason is required, and a fifth action should
 * be a row in a table, not another file.
 */
export function CampaignStatusDialog({
  campaign,
  action,
  onOpenChange,
}: {
  campaign: AdminCampaign | null;
  action: CampaignAction;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const spec = ACTIONS[action];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    ...VALIDATION_MODE,
    defaultValues: { reason: '' },
  });

  useEffect(() => {
    if (campaign) reset({ reason: '' });
  }, [campaign, action, reset]);

  const run = useMutation({
    mutationFn: (values: Values | undefined) =>
      api.post(
        `/v1/admin/campaigns/${campaign?.id ?? ''}/${action}`,
        values ? { reason: values.reason } : undefined,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all() });
      onOpenChange(false);
    },
  });

  const Icon = spec.icon;

  return (
    <Dialog
      open={campaign !== null}
      onOpenChange={onOpenChange}
      title={spec.title}
      description={campaign ? spec.describe(campaign) : undefined}
      dismissible={!run.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={run.isPending}>
            Cancel
          </Button>
          <Button
            {...(spec.needsReason
              ? { type: 'submit' as const, form: 'campaign-status' }
              : { onClick: () => run.mutate(undefined) })}
            {...(spec.variant ? { variant: spec.variant } : {})}
            leadingIcon={<Icon className="size-4" />}
            loading={run.isPending}
            disabled={!campaign}
          >
            {spec.confirm}
          </Button>
        </>
      }
    >
      {spec.needsReason ? (
        <form
          id="campaign-status"
          noValidate
          onSubmit={(event) => void handleSubmit((values) => run.mutate(values))(event)}
          className="space-y-4"
        >
          <TextareaField
            label="Reason"
            required
            autoFocus
            placeholder="The advertiser has asked us to hold until the new creative lands."
            {...(spec.hint ? { hint: spec.hint } : {})}
            error={errors.reason?.message}
            {...register('reason')}
          />
          {run.isError ? <FormError message={toDisplayMessage(run.error)} /> : null}
        </form>
      ) : run.isError ? (
        <FormError message={toDisplayMessage(run.error)} />
      ) : null}
    </Dialog>
  );
}
