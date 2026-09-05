import { useDriverEarnings } from '@/shared/api/hooks';
import { Page } from '@/shared/layout/Page';
import { Card, CardBody, CardHeader, QueryBoundary, Table, TBody, TD, TH, THead, TR } from '@/shared/ui';
import { formatDate, formatINR, formatKm } from '@/shared/format';

export default function EarningsPage() {
  const query = useDriverEarnings();

  return (
    <Page title="Earnings" greeting="Verified kilometres only — the same wallet as the driver app">
      <QueryBoundary query={query} errorTitle="Could not load earnings">
        {(data) => (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardBody>
                  <p className="text-[12px] text-slate-500">Available balance</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                    {formatINR(data.availableBalance)}
                  </p>
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  <p className="text-[12px] text-slate-500">This month</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                    {formatINR(data.monthEarnings)}
                  </p>
                  <p className="mt-0.5 text-[12px] text-slate-500">{formatKm(data.monthVerifiedKm)}</p>
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  <p className="text-[12px] text-slate-500">Pending</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                    {formatINR(data.pendingBalance)}
                  </p>
                </CardBody>
              </Card>
            </div>

            <Card>
              <CardHeader title="Recent days" description="Each row is a day’s verified kilometres" />
              <Table caption="Earnings history">
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH numeric>Verified km</TH>
                    <TH numeric>Earned</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.history.map((row) => (
                    <TR key={row.date}>
                      <TD>{formatDate(row.date)}</TD>
                      <TD numeric>{formatKm(row.verifiedKm)}</TD>
                      <TD numeric>{formatINR(row.earnings)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>
          </div>
        )}
      </QueryBoundary>
    </Page>
  );
}
