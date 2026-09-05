import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { api } from '@/shared/api/client';
import { toDisplayMessage } from '@/shared/api/errors';
import { queryKeys } from '@/shared/api/queryKeys';
import type { AdminCampaign } from '@/shared/types/domain';
import { Button, Dialog } from '@/shared/ui';
import { FormError } from '@/shared/ui/form';

/**
 * Confirm the vendor has delivered the wraps. That is what moves the
 * campaign from "at the printer" to "installing on vehicles".
 */
export function PrintReadyDialog({
  campaign,
  onOpenChange,
}: {
  campaign: AdminCampaign | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const confirm = useMutation({
    mutationFn: () => api.post(`/v1/admin/campaigns/${campaign?.id ?? ''}/print-ready`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all() });
      onOpenChange(false);
    },
  });

  return (
    <Dialog
      open={campaign !== null}
      onOpenChange={onOpenChange}
      title="Print received?"
      description={
        campaign
          ? `Confirm the printer has delivered the wraps for ${campaign.name}. The advertiser will be told the ads are ready and we are installing them on vehicles.`
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
            leadingIcon={<Printer className="size-4" />}
            onClick={() => confirm.mutate()}
            disabled={!campaign}
          >
            Mark print ready
          </Button>
        </>
      }
    >
      {confirm.isError ? <FormError message={toDisplayMessage(confirm.error)} /> : null}
    </Dialog>
  );
}
