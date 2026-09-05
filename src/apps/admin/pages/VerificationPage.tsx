import { useState } from 'react';
import { useDrivers, useInstallationQueue } from '@/shared/api/hooks';
import { Page } from '@/shared/layout/Page';
import { Card, CardBody, CardHeader, Tab, TabList, TabPanel, Tabs } from '@/shared/ui';

import { DocumentQueue } from './DocumentQueue';
import { InstallationQueue } from './InstallationQueue';

type QueueId = 'documents' | 'installations' | 'kilometres';

const QUEUES: { id: QueueId; label: string; description: string }[] = [
  {
    id: 'documents',
    label: 'Documents',
    description:
      'Driving licence, RC and insurance. A vehicle cannot be approved until every document is verified and unexpired.',
  },
  {
    id: 'installations',
    label: 'Installations',
    description:
      'Wrap photos from every required angle. A vehicle cannot become active — and therefore cannot bill — until its installation is approved (AC-06.10).',
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
                  : q.id === 'installations'
                    ? installationCount
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
                ) : q.id === 'installations' ? (
                  <InstallationQueue />
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
