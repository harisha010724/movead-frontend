import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { pageWindow } from '@/shared/lib/pageWindow';
import { InlineSelect } from './form/Select';

const pageButton =
  'grid size-8 cursor-pointer place-items-center rounded-lg text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40';

/**
 * "Showing 1–10 of 128 campaigns", a page-size select and numbered pages.
 * The page is 1-based, and is clamped by the caller when the list shrinks.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizes = [10, 25, 50],
  noun = 'items',
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizes?: number[];
  noun?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5"
    >
      <div className="flex items-center gap-3 text-[12px] text-slate-500">
        <p>
          Showing{' '}
          <span className="numeric font-medium text-slate-700">
            {first}–{last}
          </span>{' '}
          of <span className="numeric font-medium text-slate-700">{total}</span> {noun}
        </p>
        <span className="h-4 w-px bg-slate-200" aria-hidden />
        <InlineSelect
          label="Rows per page"
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(Number(value))}
          options={pageSizes.map((size) => ({ value: String(size), label: `${size} per page` }))}
          className="h-8 text-[12px]"
        />
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={cn(pageButton, 'text-slate-500 hover:bg-slate-100')}
        >
          <ChevronLeft className="size-4" />
        </button>

        {pageWindow(page, pageCount).map((entry, index) =>
          entry === null ? (
            <span key={`gap-${index}`} aria-hidden className="grid size-8 place-items-center text-slate-400">
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              aria-label={`Page ${entry}`}
              aria-current={entry === page ? 'page' : undefined}
              onClick={() => onPageChange(entry)}
              className={cn(
                pageButton,
                'numeric',
                entry === page
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {entry}
            </button>
          ),
        )}

        <button
          type="button"
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          className={cn(pageButton, 'text-slate-500 hover:bg-slate-100')}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </nav>
  );
}
