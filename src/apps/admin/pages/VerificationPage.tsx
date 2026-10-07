import { useState } from 'react';
import {
  useBrandingProofWaiting,
  useDrivers,
  useInstallationFittingQueue,
  useInstallationQueue,
} from '@/shared/api/hooks';
import { Page } from '@/shared/layout/Page';
import { Card, CardBody, CardHeader, Tab, TabList, TabPanel, Tabs } from '@/shared/ui';

import { BrandingProofQueue } from './BrandingProofQueue';
import { DocumentQueue } from './DocumentQueue';
import { FittingQueue } from './FittingQueue';
import { InstallationQueue } from './InstallationQueue';

type QueueId = 'documents' | 'fitting' | 'installations' | 'wrap-photos' | 'kilometres';

const QUEUES: { id: QueueId; label: string; description: string }[] = [
  {
    id: 'documents',
    label: 'Documents',
    description:
      'Driving licence, RC and insurance. A vehicle cannot be approved until every document is verified and unexpired.',
  },
  {
    id: 'fitting',
    label: 'Wraps to fit',
    description:
      'Vehicles assigned to a campaign whose wrap has not been photographed yet. Marking a campaign installed does not do this: tracking is gated per vehicle, so a wrap that is never photographed here leaves its driver unable to start (AC-07).',
  },
  {
    id: 'installations',
    label: 'Installations',
    description:
      'Wrap photos from every required angle. A vehicle cannot become active — and therefore cannot bill — until its installation is approved (AC-06.10).',
  },
  {
    id: 'wrap-photos',
    label: 'Wrap photos',
    description:
      'Ask a live vehicle to photograph the advertisement. Sent photos appear on the advertiser campaign — there is no ops approval step. An overdue request pauses earning.',
  },
  {
    id: 'kilometres',
    label: 'Flagged kilometres',
    description:
      'Distance held back by a fraud rule. Flagged kilometres are neither billed nor paid until a human decides.',
  },
];

export default function VerificationPage() {
  const [tab, setTab] = useState<QueueId>('documents');
  // Shared cache with the queues below, so naming the counts costs no extra fetch.
  const installationCount = useInstallationQueue().data?.items.length ?? 0;
  const fittingCount = useInstallationFittingQueue().data?.items.length ?? 0;
  const wrapCount = useBrandingProofWaiting().data?.items.length ?? 0;
  const documentCount = useDrivers({ status: 'DOCUMENTS_SUBMITTED' }).data?.items.length ?? 0;

  return (
    <Page
      title="Verification"
      greeting="Nothing becomes billable without passing through this screen"
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as QueueId)}>
        <TabList label="Verification queues">
          {QUEUES.map((q) => (
            <Tab
              key={q.id}
              value={q.id}
              count={
                q.id === 'documents'
                  ? documentCount
                  : q.id === 'fitting'
                    ? fittingCount
                    : q.id === 'installations'
                      ? installationCount
                      : q.id === 'wrap-photos'
                        ? wrapCount
                        : undefined
              }
            >
              {q.label}
            </Tab>
          ))}
        </TabList>

        {QUEUES.map((q) => (
          <TabPanel key={q.id} value={q.id}>
            <Card>
              <CardHeader title={q.label} description={q.description} />
              <CardBody>
                {/*
                  Each queue is a table plus a review pane. Approvals are
                  recorded with the reviewer's identity and a timestamp;
                  rejections require a reason, because a driver has to be told
                  what to fix.
                */}
                {q.id === 'documents' ? (
                  <DocumentQueue />
                ) : q.id === 'fitting' ? (
                  <FittingQueue />
                ) : q.id === 'installations' ? (
                  <InstallationQueue />
                ) : q.id === 'wrap-photos' ? (
                  <BrandingProofQueue />
                ) : (
                  <p className="text-[13px] text-slate-500">
                    The {q.label.toLowerCase()} queue mounts here.
                  </p>
                )}
              </CardBody>
            </Card>
          </TabPanel>
        ))}
      </Tabs>
    </Page>
  );
}
