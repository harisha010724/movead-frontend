import { describe, expect, it } from 'vitest';

import { asMoney, type AdminCampaign } from '@/shared/types/domain';
import { pageWindow } from '@/shared/lib/pageWindow';
import {
  ALL,
  DEFAULT_FILTERS,
  activeFilterCount,
  deadlineOf,
  distinctOptions,
  filterCampaigns,
  isOverdue,
  progressOf,
  sortCampaigns,
  toCsv,
} from './campaignProduction';

function campaign(overrides: Partial<AdminCampaign> = {}): AdminCampaign {
  return {
    id: 'cmp_1',
    name: 'Monsoon Launch',
    brandName: 'Zephyr',
    status: 'ACTIVE',
    city: 'Bengaluru',
    vehicleType: 'CAB',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    budget: asMoney('200000.00'),
    spent: asMoney('50000.00'),
    remaining: asMoney('150000.00'),
    vehicleCount: 12,
    verifiedKm: 0,
    impressions: 0,
    advertiser: { id: 'adv_1', legalName: 'Zephyr Beverages Pvt Ltd', brandName: 'Zephyr' },
    createdBy: 'usr_1',
    submittedAt: '2026-08-20T06:00:00.000Z',
    ...overrides,
  };
}

describe('progressOf', () => {
  it('is the share of the budget spent', () => {
    expect(progressOf(campaign())).toBe(0.25);
  });

  it('is zero before anything is spent, and never above one', () => {
    expect(progressOf(campaign({ spent: asMoney('0.00') }))).toBe(0);
    expect(progressOf(campaign({ spent: asMoney('999999.00') }))).toBe(1);
  });

  it('does not divide by a zero budget', () => {
    expect(progressOf(campaign({ budget: asMoney('0.00') }))).toBe(0);
  });
});

describe('deadlines', () => {
  it('is the start date until the campaign is on the road, then the end date', () => {
    expect(deadlineOf(campaign(), 'installing')).toBe('2026-09-01');
    expect(deadlineOf(campaign(), 'running')).toBe('2026-09-30');
  });

  it('is overdue only for a campaign still being got ready', () => {
    expect(isOverdue(campaign(), 'installing', '2026-09-05')).toBe(true);
    expect(isOverdue(campaign(), 'installing', '2026-08-30')).toBe(false);
    // Once it is on the road its start date has passed by definition.
    expect(isOverdue(campaign(), 'running', '2026-09-05')).toBe(false);
  });
});

describe('filterCampaigns', () => {
  const list = [
    campaign({ id: '1', name: 'Alpha Sale', city: 'Bengaluru' }),
    campaign({
      id: '2',
      name: 'Beta Launch',
      city: 'Mumbai',
      status: 'PAUSED',
      advertiser: { id: 'adv_2', legalName: 'Beta Foods Ltd', brandName: 'BetaFoods' },
      submittedAt: '2026-08-25T06:00:00.000Z',
    }),
  ];

  it('searches the campaign, the brand, the advertiser and the city, ignoring case', () => {
    const find = (search: string) =>
      filterCampaigns(list, { ...DEFAULT_FILTERS, search }, '2026-08-26').map((c) => c.id);
    expect(find('ALPHA')).toEqual(['1']);
    expect(find('beta foods')).toEqual(['2']);
    expect(find('mumbai')).toEqual(['2']);
    expect(find('  ')).toEqual(['1', '2']);
  });

  it('combines filters', () => {
    const filters = { ...DEFAULT_FILTERS, city: 'Mumbai', status: 'PAUSED', advertiser: 'adv_2' };
    expect(filterCampaigns(list, filters, '2026-08-26').map((c) => c.id)).toEqual(['2']);
    expect(filterCampaigns(list, { ...filters, status: 'ACTIVE' }, '2026-08-26')).toEqual([]);
  });

  it('filters by when it was submitted, in Indian days', () => {
    const within = (window: 'today' | '7d' | '30d' | 'month') =>
      filterCampaigns(list, { ...DEFAULT_FILTERS, window }, '2026-08-26').map((c) => c.id);
    expect(within('today')).toEqual([]);
    expect(within('7d')).toEqual(['1', '2']);
    expect(within('month')).toEqual(['1', '2']);
    // Seven days ending 31 Aug begin on 25 Aug, so the 20 Aug campaign drops out.
    expect(
      filterCampaigns(list, { ...DEFAULT_FILTERS, window: '7d' }, '2026-08-31').map((c) => c.id),
    ).toEqual(['2']);
  });
});

describe('sortCampaigns', () => {
  const list = [
    campaign({ id: 'a', name: 'Bravo', vehicleCount: 5, submittedAt: '2026-08-01T00:00:00Z' }),
    campaign({ id: 'b', name: 'Alpha', vehicleCount: 50, submittedAt: '2026-08-03T00:00:00Z' }),
    campaign({ id: 'c', name: 'Charlie', vehicleCount: 20, submittedAt: '2026-08-02T00:00:00Z' }),
  ];
  const ids = (sort: Parameters<typeof sortCampaigns>[1]) =>
    sortCampaigns(list, sort, 'running').map((c) => c.id);

  it('orders by each key without changing the list it was given', () => {
    expect(ids('newest')).toEqual(['b', 'c', 'a']);
    expect(ids('oldest')).toEqual(['a', 'c', 'b']);
    expect(ids('vehicles')).toEqual(['b', 'c', 'a']);
    expect(ids('name')).toEqual(['b', 'a', 'c']);
    expect(list.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('filter bookkeeping', () => {
  it('counts only the filters that narrow the list', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, sort: 'name' })).toBe(0);
    expect(
      activeFilterCount({ ...DEFAULT_FILTERS, search: 'x', city: 'Pune', window: '7d' }),
    ).toBe(3);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, city: ALL, search: '   ' })).toBe(0);
  });

  it('offers each value once, in alphabetical order', () => {
    const list = [
      campaign({ city: 'Mumbai' }),
      campaign({ city: 'Bengaluru' }),
      campaign({ city: 'Mumbai' }),
    ];
    expect(distinctOptions(list, (c) => ({ value: c.city, label: c.city }))).toEqual([
      { value: 'Bengaluru', label: 'Bengaluru' },
      { value: 'Mumbai', label: 'Mumbai' },
    ]);
  });
});

describe('toCsv', () => {
  it('quotes what needs quoting', () => {
    expect(toCsv(['a', 'b'], [['plain', 'has, comma'], ['say "hi"', 'two\nlines']])).toBe(
      'a,b\r\nplain,"has, comma"\r\n"say ""hi""","two\nlines"',
    );
  });

  /*
   * An advertiser chooses what their campaign is called, and an operator opens
   * this file in a spreadsheet. A name that starts with = must not run.
   */
  it('stops a spreadsheet running a name as a formula', () => {
    expect(toCsv(['name'], [['=HYPERLINK("http://x")'], ['+1'], ['@sum'], ['-2']])).toBe(
      'name\r\n"\'=HYPERLINK(""http://x"")"\r\n\'+1\r\n\'@sum\r\n\'-2',
    );
  });
});

describe('pageWindow', () => {
  it('lists every page when there are few', () => {
    expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps first, last and the neighbours, with gaps between', () => {
    expect(pageWindow(1, 13)).toEqual([1, 2, 3, 4, null, 13]);
    expect(pageWindow(7, 13)).toEqual([1, null, 6, 7, 8, null, 13]);
    expect(pageWindow(13, 13)).toEqual([1, null, 10, 11, 12, 13]);
  });
});
