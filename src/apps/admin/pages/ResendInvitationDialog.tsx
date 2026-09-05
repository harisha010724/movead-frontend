import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Info, Send } from 'lucide-react';
import { api } from '@/shared/api/client';
import { toDisplayMessage } from '@/shared/api/errors';
import type { AdvertiserListing } from '@/shared/api/hooks';
import { queryKeys } from '@/shared/api/queryKeys';
import { Button, Dialog } from '@/shared/ui';
import { FormError } from '@/shared/ui/form';

interface Resent {
  email: string;
  delivered: boolean;
  expiresAt: string;
}

/**
 * Sending a fresh invitation, for when the first never arrived or ran out.
 *
 * Worth confirming rather than firing straight from the menu, because it has a
 * consequence that is not obvious from the label: the previous link stops
 * working. That is deliberate — the usual reason to resend is a suspicion that
 * the first went somewhere it should not have — but an admin who resends to be
 * helpful should know they have just invalidated whatever the customer may
 * already be holding.
 */
export function ResendInvitationDialog({
  advertiser,
  onOpenChange,
}: {
  advertiser: AdvertiserListing | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const user = advertiser?.primaryUser ?? null;

  const resend = useMutation({
    mutationFn: () =>
      api.post<Resent>(`/v1/admin/users/${user?.id ?? ''}/resend-invitation`, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.advertisers.all() });
    },
  });

  useEffect(() => {
    if (advertiser) resend.reset();
    // Resetting when the dialog opens, not on every render the mutation causes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advertiser]);

  const sent = resend.data;

  return (
    <Dialog
      open={advertiser !== null}
      onOpenChange={onOpenChange}
      title={sent ? 'Invitation sent' : 'Resend invitation'}
      description={
        sent
          ? `${user?.fullName ?? 'They'} can set a password from the new link.`
          : `${user?.fullName ?? 'This user'} will get a fresh link to choose a password.`
      }
      dismissible={!resend.isPending}
      footer={
        sent ? (
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        ) : (
          <>
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={resend.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => resend.mutate()}
              loading={resend.isPending}
              leadingIcon={<Send className="size-4" />}
            >
              Send new invitation
            </Button>
          </>
        )
      }
    >
      {sent ? (
        <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
          <div className="text-[13px] text-emerald-900">
            <p className="font-medium">
              {sent.delivered ? `Sent to ${sent.email}` : `Issued for ${sent.email}`}
            </p>
            <p className="mt-1 text-emerald-800">
              {sent.delivered
                ? 'The new link expires in 72 hours. Any earlier link no longer works.'
                : 'The link is valid, but the email could not be delivered. Check the mail configuration and try again.'}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              Going to
            </p>
            <p className="mt-1 text-[15px] font-medium text-slate-900">{user?.email}</p>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-xl bg-amber-50 p-4">
            <Info className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
            <p className="text-[12px] text-amber-900">
              Any invitation they are already holding stops working. If they have the first
              email and simply have not opened it, ask them to check before you send another.
            </p>
          </div>
        </>
      )}

      {resend.isError ? (
        <div className="mt-4">
          <FormError message={toDisplayMessage(resend.error)} />
        </div>
      ) : null}
    </Dialog>
  );
}
