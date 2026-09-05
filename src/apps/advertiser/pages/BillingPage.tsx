import { Landmark, PiggyBank, Wallet } from 'lucide-react';
import { useWallet } from '@/shared/api/hooks';
import { Page } from '@/shared/layout/Page';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  QueryBoundary,
  SkeletonStatCards,
  StatCard,
} from '@/shared/ui';
import { Can } from '@/shared/auth/guards';
import { ADVERTISER_PERMISSIONS as PERMISSIONS } from '@/shared/auth/permissions';
import { formatINR } from '@/shared/format';

export default function BillingPage() {
  const query = useWallet();

  return (
    <Page
      title="Billing & Payments"
      greeting="MoveAd is prepaid — campaigns draw down as verified kilometres are billed"
      controls={
        <Can permission={PERMISSIONS.walletTopUp}>
          <Button leadingIcon={<Wallet className="size-4" />}>Add funds</Button>
        </Can>
      }
    >
      <QueryBoundary
        query={query}
        loading={<SkeletonStatCards count={3} />}
        errorTitle="Could not load your wallet"
      >
        {(wallet) => (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Wallet balance"
                value={formatINR(wallet.balance)}
                icon={Landmark}
                tone="brand"
                hint="Total funds held"
              />
              <StatCard
                label="Committed"
                value={formatINR(wallet.committed)}
                icon={PiggyBank}
                tone="amber"
                hint="Reserved by active campaigns"
              />
              <StatCard
                label="Available"
                value={formatINR(wallet.available)}
                icon={Wallet}
                tone="green"
                hint="Can be allocated to a new campaign"
              />
            </div>

            <Card>
              <CardHeader
                title="Transactions"
                description="Every entry is immutable. Corrections are posted as reversing entries, never edits."
              />
              <CardBody>
                <p className="text-sm text-slate-500">
                  The ledger table mounts here, paginated by the API.
                </p>
              </CardBody>
            </Card>
          </div>
        )}
      </QueryBoundary>
    </Page>
  );
}
