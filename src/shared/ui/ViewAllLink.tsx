import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

/** The "View All … →" affordance the design repeats at the foot of each panel. */
export function ViewAllLink({
  to,
  children,
  className,
}: {
  to: string;
  children: string;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-600 hover:text-brand-700',
        className,
      )}
    >
      {children}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}
