import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { Page } from '@/shared/layout/Page';
import { Card, EmptyState } from '@/shared/ui';

export default function NotFoundPage() {
  return (
    <Page title="Not found">
      <Card>
        <EmptyState
          icon={FileQuestion}
          title="Page not found"
          description="The page you were looking for does not exist, or you no longer have access to it."
          action={
            <Link to="/" className="text-sm font-medium text-brand-600 hover:underline">
              Back to dashboard
            </Link>
          }
        />
      </Card>
    </Page>
  );
}
