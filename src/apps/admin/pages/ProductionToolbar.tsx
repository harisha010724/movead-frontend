import { CalendarDays, Download, ListFilter, Search } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { InlineSelect } from '@/shared/ui/form';
import {
  ALL,
  type Option,
  type ProductionFilters,
  type SortKey,
  type SubmittedWindow,
} from './campaignProduction';

const WINDOWS: { value: SubmittedWindow; label: string }[] = [
  { value: 'any', label: 'Any date' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
];

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'deadline', label: 'Deadline soonest' },
  { value: 'vehicles', label: 'Most vehicles' },
  { value: 'name', label: 'Name A–Z' },
];

const iconButton =
  'relative grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:border-slate-200 disabled:hover:bg-white';

/**
 * Search, narrow, order and export the queue above the table.
 *
 * The city, advertiser and status lists offer only values that exist in the
 * stage on screen, so no choice here can lead to an empty table the operator
 * could not have predicted.
 */
export function ProductionToolbar({
  filters,
  onChange,
  cities,
  advertisers,
  statuses,
  activeCount,
  onReset,
  onExport,
  canExport,
}: {
  filters: ProductionFilters;
  onChange: (patch: Partial<ProductionFilters>) => void;
  cities: Option[];
  advertisers: Option[];
  statuses: Option[];
  activeCount: number;
  onReset: () => void;
  onExport: () => void;
  canExport: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <label className="relative min-w-[220px] flex-1 sm:max-w-xs">
        <span className="sr-only">Search campaigns</span>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          type="search"
          value={filters.search}
          onChange={(event) => onChange({ search: event.target.value })}
          placeholder="Search campaign, advertiser…"
          className={cn(
            'h-9 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-[13px] text-slate-900',
            'placeholder:text-slate-400 hover:border-slate-300',
            'focus:border-brand-500 focus:ring-brand-500/25 focus:ring-2 focus:outline-none',
          )}
        />
      </label>

      <InlineSelect
        label="City"
        value={filters.city}
        onValueChange={(city) => onChange({ city })}
        options={[{ value: ALL, label: 'All cities' }, ...cities]}
        className="w-36"
      />
      <InlineSelect
        label="Advertiser"
        value={filters.advertiser}
        onValueChange={(advertiser) => onChange({ advertiser })}
        options={[{ value: ALL, label: 'All advertisers' }, ...advertisers]}
        className="w-44"
      />
      <InlineSelect
        label="Status"
        value={filters.status}
        onValueChange={(status) => onChange({ status })}
        options={[{ value: ALL, label: 'All statuses' }, ...statuses]}
        className="w-36"
      />
      <InlineSelect
        label="Submitted"
        value={filters.window}
        onValueChange={(window) => onChange({ window: window as SubmittedWindow })}
        options={WINDOWS}
        leadingIcon={<CalendarDays className="size-4 text-slate-400" aria-hidden />}
        className="w-40"
      />

      <div className="ml-auto flex items-center gap-2.5">
        <InlineSelect
          label="Sort by"
          value={filters.sort}
          onValueChange={(sort) => onChange({ sort: sort as SortKey })}
          options={SORTS}
          leadingIcon={<span className="text-slate-400">Sort by:</span>}
          className="w-52"
        />
        <button
          type="button"
          onClick={onReset}
          disabled={activeCount === 0}
          aria-label={activeCount > 0 ? `Clear filters (${activeCount})` : 'Clear filters'}
          title="Clear filters"
          className={iconButton}
        >
          <ListFilter className="size-4" aria-hidden />
          {activeCount > 0 ? (
            <span className="numeric bg-brand-600 absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full text-[10px] font-semibold text-white">
              {activeCount}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={!canExport}
          aria-label="Export to CSV"
          title="Export to CSV"
          className={iconButton}
        >
          <Download className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
