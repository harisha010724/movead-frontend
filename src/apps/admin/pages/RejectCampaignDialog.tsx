import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '@/shared/api/client';
import { toDisplayMessage } from '@/shared/api/errors';
import { queryKeys } from '@/shared/api/queryKeys';
import { VALIDATION_MODE } from '@/shared/lib/formConfig';
import type { AdminCampaign } from '@/shared/types/domain';
import { Button, Dialog } from '@/shared/ui';
import { FormError, TextareaField } from '@/shared/ui/form';

const schema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, 'Give a reason the advertiser can act on')
    .max(500, 'Reason must be 500 characters or fewer'),
});

type Values = z.infer<typeof schema>;

/**
 * A rejection always carries a reason — same rule as driver and vehicle
 * review. The campaign is cancelled so it leaves the queue; the advertiser
 * can submit a new brief.
 */
export function RejectCampaignDialog({
  campaign,
  onOpenChange,
}: {
  campaign: AdminCampaign | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
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
  }, [campaign, reset]);

  const reject = useMutation({
    mutationFn: (values: Values) =>
      api.post(`/v1/admin/campaigns/${campaign?.id ?? ''}/reject`, { reason: values.reason }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all() });
      onOpenChange(false);
    },
  });

  return (
    <Dialog
      open={campaign !== null}
      onOpenChange={onOpenChange}
      title="Reject campaign"
      description={campaign ? `${campaign.name} will be cancelled and leave the review queue.` : undefined}
      dismissible={!reject.isPending}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={reject.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="reject-campaign"
            variant="danger"
            loading={reject.isPending}
          >
            Reject campaign
          </Button>
        </>
      }
    >
      <form
        id="reject-campaign"
        noValidate
        onSubmit={(event) => void handleSubmit((values) => reject.mutate(values))(event)}
        className="space-y-4"
      >
        <TextareaField
          label="Reason"
          required
          autoFocus
          placeholder="The wrap dimensions do not match the cab template."
          hint="Shown in the audit trail. At least 10 characters."
          error={errors.reason?.message}
          {...register('reason')}
        />
        {reject.isError ? <FormError message={toDisplayMessage(reject.error)} /> : null}
      </form>
    </Dialog>
  );
}
