import { Banknote, ShieldAlert } from 'lucide-react';
import { Page } from '@/shared/layout/Page';
import { Button, Card, CardBody, CardHeader, EmptyState } from '@/shared/ui';
import { Can } from '@/shared/auth/guards';
import { ADMIN_PERMISSIONS as PERMISSIONS } from '@/shared/auth/permissions';

export default function PayoutsPage() {
  return (
    <Page
      title="Payouts"
      greeting="Weekly runs covering Monday to Sunday, released after review"
      controls={
        <Can permission={PERMISSIONS.payoutRun}>
          <Button variant="secondary" leadingIcon={<Banknote className="size-4" />}>
            Prepare run
          </Button>
        </Can>
      }
    >
      <Card className="mb-5 bg-amber-50">
        <CardBody className="flex items-start gap-3 pt-5">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-900">
            <p className="font-medium">Preparing and releasing are separate actions.</p>
            <p className="mt-1">
              The person who prepares a run cannot release it. Release requires a second admin
              and an idempotency key, so a retried request can never pay a driver twice.
            </p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Payout runs" />
        <EmptyState
          icon={Banknote}
          title="No payout runs yet"
          description="A run aggregates every verified, unpaid kilometre for the week into one payment per driver."
        />
      </Card>
    </Page>
  );
}
