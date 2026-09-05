import { useDriverProfile } from '@/shared/api/hooks';
import { useAuth } from '@/shared/auth/useAuth';
import { Page } from '@/shared/layout/Page';
import type { DriverPortalStatus } from '@/shared/types/domain';
import { Badge, Button, Card, CardBody, QueryBoundary } from '@/shared/ui';

/** The API's vocabulary is not the driver's. Rendering the enum raw showed them "documents_submitted". */
const STATUS_LABEL: Record<DriverPortalStatus, string> = {
  pending: 'Awaiting verification',
  documents_submitted: 'Documents under review',
  approved: 'Approved',
  suspended: 'Suspended',
};

export default function ProfilePage() {
  const query = useDriverProfile();
  const { logout } = useAuth();

  return (
    <Page title="Profile" greeting="The same account as the driver app">
      <QueryBoundary query={query} errorTitle="Could not load profile">
        {(data) => (
          <Card>
            <CardBody>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-slate-900">{data.name}</p>
                  <p className="mt-0.5 text-[13px] text-slate-500">{data.mobile}</p>
                  {data.vehicle ? (
                    <p className="mt-1 text-[13px] text-slate-600">
                      {data.vehicle.makeModel} · {data.vehicle.registrationNumber}
                    </p>
                  ) : null}
                </div>
                <Badge tone={data.canTrack ? 'success' : 'warning'}>
                  {data.canTrack ? 'Approved to track' : STATUS_LABEL[data.status]}
                </Badge>
              </div>
              <div className="mt-6">
                <Button variant="danger" onClick={() => void logout()}>
                  Sign out
                </Button>
              </div>
            </CardBody>
          </Card>
        )}
      </QueryBoundary>
    </Page>
  );
}
