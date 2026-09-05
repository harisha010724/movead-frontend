import { useState } from 'react';
import { Building2, MoreHorizontal, Pencil, Send } from 'lucide-react';
import { useAdminAdvertisers, type AdvertiserListing } from '@/shared/api/hooks';
import { Page } from '@/shared/layout/Page';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Menu,
  MenuItem,
  MenuSeparator,
  QueryBoundary,
  SkeletonTable,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/shared/ui';
import { Can } from '@/shared/auth/guards';
import { ADMIN_PERMISSIONS as PERMISSIONS } from '@/shared/auth/permissions';
import { formatDate } from '@/shared/format';
import { EditAdvertiserDialog } from './EditAdvertiserDialog';
import { OnboardAdvertiserDialog } from './OnboardAdvertiserDialog';
import { ResendInvitationDialog } from './ResendInvitationDialog';

const statusTone = (status: AdvertiserListing['status']) => {
  if (status === 'ACTIVE') return 'success' as const;
  if (status === 'SUSPENDED' || status === 'CLOSED') return 'danger' as const;
  return 'warning' as const;
};

/**
 * Whether the contact has actually got in yet.
 *
 * Worth its own column rather than being folded into the advertiser's status,
 * because they answer different questions. The advertiser is in Onboarding
 * until their wallet is funded, which is a billing matter; the contact is
 * Invited until they follow the link, which is the thing an operator chasing a
 * new customer needs to see.
 */
function contactState(user: AdvertiserListing['primaryUser']) {
  if (!user) return { label: 'No user', tone: 'danger' as const };
  if (user.status === 'ACTIVE') return { label: 'Signed up', tone: 'success' as const };

  if (user.invitationExpiresAt && new Date(user.invitationExpiresAt) <= new Date()) {
    return { label: 'Invitation expired', tone: 'danger' as const };
  }

  return { label: 'Invited', tone: 'info' as const };
}

export default function AdvertisersPage() {
  const [onboarding, setOnboarding] = useState(false);
  const [editing, setEditing] = useState<AdvertiserListing | null>(null);
  const [resending, setResending] = useState<AdvertiserListing | null>(null);
  const query = useAdminAdvertisers();

  /*
   * Radix returns focus to the menu trigger as it closes, and opening a dialog
   * in the same tick leaves the body with `pointer-events: none`. Same fix as
   * the Drivers table.
   */
  const openAfterMenuCloses = (open: () => void) => () => {
    setTimeout(open, 0);
  };

  return (
    <Page
      title="Advertisers"
      greeting="There is no advertiser self-registration — every account is created here"
      controls={
        <Can permission={PERMISSIONS.advertiserCreate}>
          <Button
            onClick={() => setOnboarding(true)}
            leadingIcon={<Building2 className="size-4" />}
          >
            Onboard advertiser
          </Button>
        </Can>
      }
    >
      <Card>
        <CardHeader
          title="Accounts"
          description="Each advertiser has a prepaid wallet and sees only their own campaigns and vehicles."
        />

        <QueryBoundary
          query={query}
          loading={<SkeletonTable rows={4} columns={6} />}
          isEmpty={(data) => data.length === 0}
          empty={
            <EmptyState
              icon={Building2}
              title="No advertisers onboarded yet"
              description="Onboarding creates the organisation and its first user, then emails them a link to choose a password."
              action={
                <Can permission={PERMISSIONS.advertiserCreate}>
                  <Button onClick={() => setOnboarding(true)}>Onboard advertiser</Button>
                </Can>
              }
            />
          }
        >
          {(data) => (
            <Table caption="Advertiser accounts">
              <THead>
                <TR>
                  <TH>Advertiser</TH>
                  <TH>Primary user</TH>
                  <TH>Access</TH>
                  <TH>Account</TH>
                  <TH>Onboarded</TH>
                  <TH>
                    <span className="sr-only">Actions</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {data.map((advertiser) => {
                  const access = contactState(advertiser.primaryUser);

                  return (
                    <TR key={advertiser.id}>
                      <TD>
                        <span className="font-medium text-slate-900">
                          {advertiser.brandName}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-slate-500">
                          {advertiser.legalName}
                        </span>
                      </TD>
                      <TD>
                        {advertiser.primaryUser ? (
                          <>
                            <span className="text-slate-700">
                              {advertiser.primaryUser.fullName}
                            </span>
                            <span className="mt-0.5 block text-[12px] text-slate-500">
                              {advertiser.primaryUser.email}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TD>
                      <TD>
                        <Badge tone={access.tone}>{access.label}</Badge>
                      </TD>
                      <TD>
                        <Badge tone={statusTone(advertiser.status)}>
                          {advertiser.status.toLowerCase()}
                        </Badge>
                      </TD>
                      <TD className="text-slate-600">{formatDate(advertiser.createdAt)}</TD>
                      <TD className="w-px">
                        <Menu
                          trigger={
                            <button
                              type="button"
                              aria-label={`Actions for ${advertiser.brandName}`}
                              className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none"
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                          }
                        >
                          <Can permission={PERMISSIONS.advertiserCreate}>
                            <MenuItem
                              icon={Pencil}
                              onSelect={openAfterMenuCloses(() => setEditing(advertiser))}
                            >
                              Edit advertiser
                            </MenuItem>
                          </Can>

                          {/* Only while there is somebody still waiting on a link. */}
                          {advertiser.primaryUser && advertiser.primaryUser.status !== 'ACTIVE' ? (
                            <Can permission={PERMISSIONS.userCreate}>
                              <MenuSeparator />
                              <MenuItem
                                icon={Send}
                                onSelect={openAfterMenuCloses(() => setResending(advertiser))}
                              >
                                Resend invitation
                              </MenuItem>
                            </Can>
                          ) : null}
                        </Menu>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </QueryBoundary>
      </Card>

      <OnboardAdvertiserDialog open={onboarding} onOpenChange={setOnboarding} />
      <EditAdvertiserDialog
        advertiser={editing}
        onOpenChange={() => {
          setEditing(null);
        }}
      />
      <ResendInvitationDialog
        advertiser={resending}
        onOpenChange={() => {
          setResending(null);
        }}
      />
    </Page>
  );
}
