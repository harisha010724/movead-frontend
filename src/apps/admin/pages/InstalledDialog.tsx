import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Truck } from 'lucide-react';
import { api } from '@/shared/api/client';
import { toDisplayMessage } from '@/shared/api/errors';
import { queryKeys } from '@/shared/api/queryKeys';
import type { AdminCampaign } from '@/shared/types/domain';
import { Button, Dialog } from '@/shared/ui';
import { FormError } from '@/shared/ui/form';

/**
 * Confirm the wraps are on the vehicles. That is what moves the campaign
 * from installing to live — campaign-level until each vehicle has its own
 * installation record.
 */
export function InstalledDialog({
  campaign,
  onOpenChange,
}: {
  campaign: AdminCampaign | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const confirm = useMutation({
    mutationFn: () => api.post(`/v1/admin/campaigns/${campaign?.id ?? ''}/installed`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all() });
      onOpenChange(false);
    },
  });

  return (
    <Dialog
      open={campaign !== null}
      onOpenChange={onOpenChange}
      title="Installed on vehicles?"
      description={
        campaign
          ? `Confirm the ads for ${campaign.name} are on the vehicles. The campaign will go live and the advertiser will be told.`
          : undefined
      }
      dismissible={!confirm.isPending}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={confirm.isPending}
          >
            Not yet
          </Button>
          <Button
            loading={confirm.isPending}
            leadingIcon={<Truck className="size-4" />}
            onClick={() => confirm.mutate()}
            disabled={!campaign}
          >
            Mark installed
          </Button>
        </>
      }
    >
      {confirm.isError ? <FormError message={toDisplayMessage(confirm.error)} /> : null}
    </Dialog>
  );
}
