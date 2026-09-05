import { Link } from 'react-router-dom';
import { FileCheck2 } from 'lucide-react';
import { useDrivers } from '@/shared/api/hooks';
import { adminPath } from '@/shared/auth/portals';
import { formatDate, formatRegistration } from '@/shared/format';
import {
  Button,
  EmptyState,
  QueryBoundary,
  SkeletonTable,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/shared/ui';

/**
 * Drivers who have sent their whole mandatory set and are waiting on a person.
 *
 * The queue is derived from the driver status rather than from a documents
 * endpoint of its own: `DOCUMENTS_SUBMITTED` already means exactly "everything
 * mandatory is in and nobody has looked yet", and a second source for the same
 * fact is a second thing that can disagree.
 */
export function DocumentQueue() {
  const query = useDrivers({ status: 'DOCUMENTS_SUBMITTED' });

  return (
    <QueryBoundary
      query={query}
      loading={<SkeletonTable rows={4} columns={5} />}
      isEmpty={(data) => data.items.length === 0}
      empty={
        <EmptyState
          icon={FileCheck2}
          title="Nothing waiting"
          description="Drivers appear here once they have sent every mandatory document."
        />
      }
      errorTitle="Could not load the document queue"
    >
      {(data) => (
        <Table caption="Drivers awaiting document review">
          <THead>
            <TR>
              <TH>Driver</TH>
              <TH>Mobile</TH>
              <TH>Vehicle</TH>
              <TH>Registered</TH>
              <TH align="right">
                <span className="sr-only">Review</span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {data.items.map((driver) => (
              <TR key={driver.id}>
                <TD className="font-medium text-slate-900">{driver.name}</TD>
                <TD className="numeric text-slate-600">{driver.mobile}</TD>
                <TD className="numeric text-slate-600">
                  {driver.vehicle ? formatRegistration(driver.vehicle.registrationNumber) : '—'}
                </TD>
                <TD className="text-slate-600">{formatDate(driver.joinedAt)}</TD>
                <TD align="right">
                  <Button size="sm" variant="secondary" asChild>
                    <Link to={adminPath(`/drivers/${driver.id}`)}>Review</Link>
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </QueryBoundary>
  );
}
