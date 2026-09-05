import { CheckCircle2, Circle } from 'lucide-react';
import { useDriverEligibility } from '@/shared/api/hooks';
import { Page } from '@/shared/layout/Page';
import { Badge, Card, CardBody, CardHeader, QueryBoundary } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';

/**
 * Web cannot run the phone’s background GPS. This screen shows the same
 * eligibility gates as the app (AC-07) and sends the driver to the app to
 * start. Consent is one of them and can only be given on the handset, so a
 * driver can arrive here, learn what is missing, and still have to leave.
 */
export default function TrackPage() {
  const query = useDriverEligibility();

  return (
    <Page
      title="Track"
      greeting="Start a session from the MoveAd driver app — live GPS does not run in the browser"
    >
      <QueryBoundary query={query} errorTitle="Could not load eligibility">
        {(data) => (
          <Card>
            <CardHeader
              title="Ready to track?"
              description="Every gate must be green before kilometres can accrue."
              action={
                <Badge tone={data.eligible ? 'success' : 'warning'}>
                  {data.eligible ? 'Eligible' : 'Not ready'}
                </Badge>
              }
            />
            <CardBody>
              {/*
                UI-036.3: every unmet condition is listed with what to do about
                it. A driver who fixes one gate and is only then told about the
                next will stop believing the screen.
              */}
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {data.checks.map((check) => (
                  <li key={check.id} className="flex items-start gap-3 px-4 py-3">
                    {check.passed ? (
                      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
                    ) : (
                      <Circle className="mt-0.5 size-5 shrink-0 text-slate-300" aria-hidden />
                    )}
                    <div>
                      <span
                        className={cn(
                          'text-[13px] font-medium',
                          check.passed ? 'text-slate-800' : 'text-slate-500',
                        )}
                      >
                        {check.label}
                      </span>
                      {!check.passed && check.remedy && (
                        <p className="mt-0.5 text-[12px] text-slate-500">{check.remedy}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[13px] text-slate-500">
                Open the driver app on your phone and press Start campaign. The browser can show
                your status and earnings, but it cannot collect GPS.
              </p>
            </CardBody>
          </Card>
        )}
      </QueryBoundary>
    </Page>
  );
}
