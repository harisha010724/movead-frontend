import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, MapPin, Search, X } from 'lucide-react';
import { useLivePositions } from '@/shared/api/hooks';
import { Page } from '@/shared/layout/Page';
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  FleetStatusBar,
  LiveStateBadge,
  QueryBoundary,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  liveStateLabel,
} from '@/shared/ui';
import { LiveFleetMap } from '@/shared/maps/LiveFleetMap';
import { formatCount, formatRegistration, formatRelative } from '@/shared/format';
import { normaliseRegistration } from '@/shared/format/vehicle';
import { useDebouncedValue } from '@/shared/lib/useDebouncedValue';
import { cn } from '@/shared/lib/cn';
import type { LiveVehicleState } from '@/shared/types/domain';

/*
 * GPS_PAUSED sits next to IDLE rather than at the end: both mean the vehicle
 * is reachable but not accruing kilometres, and reading them together is how
 * an advertiser sees how much of the fleet is not currently earning.
 */
const STATE_ORDER: LiveVehicleState[] = ['RUNNING', 'IDLE', 'GPS_PAUSED', 'OFFLINE'];

/** Below this the search is ignored, matching what the API will accept. */
const MIN_SEARCH = 2;

/** The plate lives in the URL, so a tracked vehicle is a link someone can send. */
const SEARCH_PARAM = 'vehicle';

export default function LiveTrackingPage() {
  const [params, setParams] = useSearchParams();

  const [draft, setDraft] = useState(() => params.get(SEARCH_PARAM) ?? '');
  const search = normaliseRegistration(useDebouncedValue(draft));
  const searching = search.length >= MIN_SEARCH;

  const [filter, setFilter] = useState<LiveVehicleState | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  /*
   * The settled term, not the keystroke, so the address bar is not rewritten
   * nine times while a plate is typed. `replace` keeps it out of the history
   * stack for the same reason — Back should leave the page, not walk the
   * search backwards one letter at a time.
   */
  useEffect(() => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (searching) next.set(SEARCH_PARAM, search);
        else next.delete(SEARCH_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [search, searching, setParams]);

  const query = useLivePositions(null, searching ? search : null);

  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  /*
   * Derived, not held in state: positions arrive every ten seconds, and
   * reconciling a stored selection against each one means setting state from
   * an effect on every poll, which cascades a second render each time.
   *
   * Two rules, in order. A vehicle the current results no longer contain is
   * dropped, so the map never points at one that has left the campaign. And a
   * search narrowed to a single vehicle selects it — that is the point of
   * typing a plate: the answer is a vehicle on a map, not a list of one that
   * then has to be clicked.
   */
  const selected = useMemo(() => {
    if (picked && items.some((item) => item.vehicleRef === picked)) return picked;
    if (searching && items.length === 1) return items[0]?.vehicleRef ?? null;
    return null;
  }, [picked, items, searching]);

  function clearSearch() {
    setDraft('');
    setPicked(null);
  }

  return (
    <Page
      title="Live Tracking"
      greeting="Positions refresh every ten seconds while this tab is in the foreground"
    >
      <div className="space-y-5">
        <Card>
          <CardBody className="py-4">
            <label className="relative block">
              <span className="sr-only">Search by vehicle number</span>
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Search by vehicle number, e.g. KA01AB1234"
                autoComplete="off"
                spellCheck={false}
                className="focus:border-brand-500 focus:ring-brand-500/20 h-10 w-full rounded-lg border border-slate-200 bg-white pr-9 pl-9 text-[13px] text-slate-900 uppercase placeholder:text-slate-400 placeholder:normal-case focus:ring-2 focus:outline-none"
              />
              {draft ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Clear vehicle number search"
                  className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </label>
            <p className="mt-2 text-[11px] text-slate-500">
              {draft && !searching
                ? `Type at least ${String(MIN_SEARCH)} characters to search.`
                : 'Part of a number is enough — spaces and dashes are ignored.'}
            </p>
          </CardBody>
        </Card>

        <QueryBoundary
          query={query}
          errorTitle="Could not load live positions"
          isEmpty={(d) => d.items.length === 0}
          empty={
            <Card>
              {searching ? (
                <EmptyState
                  icon={Search}
                  title={`No tracking vehicle matches ${formatRegistration(search)}`}
                  description="Check the number, or clear the search to see the rest of the fleet. A vehicle that has never reported a position does not appear here."
                  action={
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="text-brand-600 hover:text-brand-700 text-[13px] font-medium"
                    >
                      Clear search
                    </button>
                  }
                />
              ) : (
                <EmptyState
                  icon={MapPin}
                  title="No vehicles are currently tracking"
                  description="Positions appear here when drivers start a campaign session."
                />
              )}
            </Card>
          }
        >
          {(data) => {
            const counts = STATE_ORDER.map((state) => ({
              state,
              count: data.items.filter((v) => v.state === state).length,
            }));

            const visible = filter ? data.items.filter((v) => v.state === filter) : data.items;

            return (
              <div className="space-y-5">
                <FleetStatusBar
                  statuses={counts}
                  selected={filter}
                  onSelect={setFilter}
                  updatedLabel={`Updated ${formatRelative(data.updatedAt)}`}
                />

                <div className="grid gap-5 xl:grid-cols-3">
                  <Card className="xl:col-span-2">
                    <CardHeader
                      title="Map"
                      description={
                        selected
                          ? `Following ${formatRegistration(selected)}`
                          : filter
                            ? `Showing ${liveStateLabel(filter).toLowerCase()} vehicles only`
                            : 'All tracking vehicles'
                      }
                    />
                    <CardBody>
                      {/*
                        No status overlay here: the counts live in the fleet bar
                        above, and duplicating them let the two disagree.
                      */}
                      <div className="h-[440px]">
                        <LiveFleetMap
                          positions={visible}
                          selectedRef={selected}
                          onSelect={setPicked}
                        />
                      </div>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader
                      title="Vehicles"
                      description="Each vehicle is named by its number plate. The driver behind it is not named."
                    />

                    {filter ? (
                      <div className="flex items-center justify-between border-y border-slate-100 bg-slate-50/70 px-5 py-2">
                        <p className="text-[11px] text-slate-500">
                          Showing{' '}
                          <span className="numeric font-medium text-slate-700">
                            {formatCount(visible.length)}
                          </span>{' '}
                          of <span className="numeric">{formatCount(data.items.length)}</span> ·{' '}
                          {liveStateLabel(filter)}
                        </p>
                        <button
                          type="button"
                          onClick={() => setFilter(null)}
                          className="text-brand-600 hover:text-brand-700 text-[11px] font-medium"
                        >
                          Clear
                        </button>
                      </div>
                    ) : null}

                    {visible.length === 0 ? (
                      <EmptyState
                        icon={Filter}
                        title={`No ${liveStateLabel(filter ?? 'RUNNING').toLowerCase()} vehicles`}
                        description="Clear the filter to see the rest of the fleet."
                        action={
                          <button
                            type="button"
                            onClick={() => setFilter(null)}
                            className="text-brand-600 hover:text-brand-700 text-[13px] font-medium"
                          >
                            Show all vehicles
                          </button>
                        }
                      />
                    ) : (
                      <div className="max-h-[480px] overflow-y-auto">
                        <Table caption="Live vehicle positions" dense>
                          <THead>
                            <TR>
                              <TH>Vehicle</TH>
                              <TH>State</TH>
                              <TH align="right">Updated</TH>
                            </TR>
                          </THead>
                          <TBody>
                            {visible.map((v) => {
                              const isSelected = v.vehicleRef === selected;
                              return (
                                <TR
                                  key={v.vehicleRef}
                                  className={cn(isSelected && 'bg-brand-50/70')}
                                >
                                  <TD>
                                    {/*
                                      The plate is the control, rather than the
                                      whole row: a clickable `tr` cannot be
                                      tabbed to and announces nothing.
                                    */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPicked(isSelected ? null : v.vehicleRef)
                                      }
                                      aria-pressed={isSelected}
                                      className={cn(
                                        'focus-visible:ring-brand-500/40 rounded font-medium focus-visible:ring-2 focus-visible:outline-none',
                                        isSelected
                                          ? 'text-brand-700'
                                          : 'text-slate-900 hover:text-brand-600',
                                      )}
                                    >
                                      {formatRegistration(v.vehicleRef)}
                                    </button>
                                  </TD>
                                  <TD>
                                    <LiveStateBadge state={v.state} />
                                  </TD>
                                  <TD align="right" className="text-[11px] text-slate-500">
                                    {formatRelative(v.updatedAt)}
                                  </TD>
                                </TR>
                              );
                            })}
                          </TBody>
                        </Table>
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            );
          }}
        </QueryBoundary>
      </div>
    </Page>
  );
}
