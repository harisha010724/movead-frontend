import { Construction } from 'lucide-react';
import { TopBar } from '@/shared/layout/TopBar';
import { Card, EmptyState } from '@/shared/ui';

/** Keeps every link in the designed sidebar navigable while screens are built. */
export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <TopBar title={title} />
      <div className="flex-1 px-6 py-6">
        <Card>
          <EmptyState
            icon={Construction}
            title={`${title} is not built yet`}
            description="This route exists so the navigation in the approved design is complete. Replace it with the real screen."
          />
        </Card>
      </div>
    </>
  );
}
