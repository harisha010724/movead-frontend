import { PLATFORM_TIMEZONE } from '@/shared/format';
import { addIsoDays, platformTodayIso } from '@/shared/lib/civilDate';
import type { AdminCampaign, CampaignStatus } from '@/shared/types/domain';

/**
 * The rules behind the production queue's search, filters, sort and export.
 * Pure on purpose: the page only decides what to show, this decides which
 * campaigns and in what order, so each rule can be tested without a screen.
 */

export type StageId = 'review' | 'printing' | 'installing' | 'running';

/** The value of a filter that lets everything through. */
export const ALL = 'all';

export type SubmittedWindow = 'any' | 'today' | '7d' | '30d' | 'month';
export type SortKey = 'newest' | 'oldest' | 'deadline' | 'vehicles' | 'name';

export interface ProductionFilters {
  search: string;
  city: string;
  advertiser: string;
  status: string;
  window: SubmittedWindow;
  sort: SortKey;
}

export const DEFAULT_FILTERS: ProductionFilters = {
  search: '',
  city: ALL,
  advertiser: ALL,
  status: ALL,
  window: 'any',
  sort: 'newest',
};

/** How many of the filters are narrowing the list. Sort does not narrow it. */
export function activeFilterCount(filters: ProductionFilters): number {
  return [
    filters.search.trim() !== '',
    filters.city !== ALL,
    filters.advertiser !== ALL,
    filters.status !== ALL,
    filters.window !== 'any',
  ].filter(Boolean).length;
}

const civilDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: PLATFORM_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The Indian calendar day of a timestamp, so "today" means today in India. */
export function civilDayOf(timestamp: string): string {
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? '' : civilDay.format(parsed);
}

/**
 * A campaign has to be on vehicles by its start date, and is over after its end
 * date. So the date an operator is racing depends on which stage they are in.
 */
export function deadlineOf(campaign: AdminCampaign, stage: StageId): string {
  return (stage === 'running' ? campaign.endDate : campaign.startDate).slice(0, 10);
}

/** Before a campaign is on the road its deadline can already have passed. */
export function isOverdue(
  campaign: AdminCampaign,
  stage: StageId,
  today: string = platformTodayIso(),
): boolean {
  return stage !== 'running' && deadlineOf(campaign, stage) < today;
}

/** Share of the budget spent, 0 to 1. The only progress the data can state truthfully. */
export function progressOf(campaign: AdminCampaign): number {
  const budget = Number(campaign.budget);
  const spent = Number(campaign.spent);
  if (!Number.isFinite(budget) || budget <= 0 || !Number.isFinite(spent) || spent <= 0) return 0;
  return Math.min(1, spent / budget);
}

function withinWindow(submittedAt: string, window: SubmittedWindow, today: string): boolean {
  if (window === 'any') return true;
  const day = civilDayOf(submittedAt);
  if (!day) return false;
  switch (window) {
    case 'today':
      return day === today;
    case '7d':
      return day >= addIsoDays(today, -6) && day <= today;
    case '30d':
      return day >= addIsoDays(today, -29) && day <= today;
    case 'month':
      return day.slice(0, 7) === today.slice(0, 7);
  }
}

function matchesSearch(campaign: AdminCampaign, needle: string): boolean {
  if (!needle) return true;
  return [
    campaign.name,
    campaign.brandName,
    campaign.advertiser.brandName,
    campaign.advertiser.legalName,
    campaign.city,
  ].some((field) => field.toLowerCase().includes(needle));
}

export function filterCampaigns(
  campaigns: AdminCampaign[],
  filters: ProductionFilters,
  today: string = platformTodayIso(),
): AdminCampaign[] {
  const needle = filters.search.trim().toLowerCase();
  return campaigns.filter(
    (campaign) =>
      matchesSearch(campaign, needle) &&
      (filters.city === ALL || campaign.city === filters.city) &&
      (filters.advertiser === ALL || campaign.advertiser.id === filters.advertiser) &&
      (filters.status === ALL || campaign.status === filters.status) &&
      withinWindow(campaign.submittedAt, filters.window, today),
  );
}

export function sortCampaigns(
  campaigns: AdminCampaign[],
  sort: SortKey,
  stage: StageId,
): AdminCampaign[] {
  const rows = [...campaigns];
  switch (sort) {
    case 'newest':
      return rows.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    case 'oldest':
      return rows.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    case 'deadline':
      return rows.sort((a, b) => deadlineOf(a, stage).localeCompare(deadlineOf(b, stage)));
    case 'vehicles':
      return rows.sort((a, b) => b.vehicleCount - a.vehicleCount);
    case 'name':
      return rows.sort((a, b) => a.name.localeCompare(b.name));
  }
}

/** The words the status badge uses, so a filter and the badge never disagree. */
export const STATUS_LABEL: Partial<Record<CampaignStatus, string>> = {
  PENDING_APPROVAL: 'In review',
  APPROVED: 'At printer',
  AWAITING_INSTALLATION: 'Installing',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
};

export interface Option {
  value: string;
  label: string;
}

/** Distinct values present in this list, for a filter that offers only what exists. */
export function distinctOptions(
  campaigns: AdminCampaign[],
  pick: (campaign: AdminCampaign) => Option,
): Option[] {
  const seen = new Map<string, string>();
  for (const campaign of campaigns) {
    const { value, label } = pick(campaign);
    if (!seen.has(value)) seen.set(value, label);
  }
  return [...seen.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * A spreadsheet runs a cell that starts with = + - or @ as a formula, and an
 * advertiser chooses what their campaign is called. Prefix those with an
 * apostrophe so a name can never execute when an operator opens the export.
 */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}
