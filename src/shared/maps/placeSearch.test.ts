import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachPlaceSearch, type PlaceChoice } from './placeSearch';

const fetchSuggestions = vi.fn();
const fetchFields = vi.fn();

function suggestion(main: string, secondary: string) {
  return {
    placePrediction: {
      text: { text: `${main}, ${secondary}`, matches: [] },
      mainText: { text: main, matches: [{ startOffset: 0, endOffset: 3 }] },
      secondaryText: { text: secondary, matches: [] },
      toPlace: () => ({
        id: 'place-1',
        displayName: main,
        formattedAddress: `${main}, ${secondary}`,
        location: { lat: () => 12.97, lng: () => 77.59 },
        addressComponents: [{ longText: main, shortText: main, types: ['locality'] }],
        fetchFields,
      }),
    },
  };
}

function type(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('attachPlaceSearch', () => {
  let input: HTMLInputElement;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchSuggestions.mockReset();
    fetchFields.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal('google', {
      maps: {
        places: {
          AutocompleteSessionToken: class {},
          AutocompleteSuggestion: { fetchAutocompleteSuggestions: fetchSuggestions },
        },
      },
    });
    input = document.createElement('input');
    document.body.append(input);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('lists suggestions after a pause and returns the chosen place', async () => {
    fetchSuggestions.mockResolvedValue({
      suggestions: [suggestion('Bengaluru', 'Karnataka, India')],
    });
    const picked: PlaceChoice[] = [];
    attachPlaceSearch({
      input,
      includedPrimaryTypes: ['(cities)'],
      onSelect: (place) => picked.push(place),
    });

    type(input, 'Ben');
    await vi.advanceTimersByTimeAsync(300);

    expect(fetchSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({
        input: 'Ben',
        includedRegionCodes: ['in'],
        includedPrimaryTypes: ['(cities)'],
      }),
    );
    const rows = document.querySelectorAll('.pac-container .pac-item');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain('Bengaluru');

    (rows[0] as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(0);

    expect(picked).toEqual([
      {
        placeId: 'place-1',
        name: 'Bengaluru',
        formattedAddress: 'Bengaluru, Karnataka, India',
        lat: 12.97,
        lng: 77.59,
        addressComponents: [{ long_name: 'Bengaluru', types: ['locality'] }],
      },
    ]);
    expect(document.querySelector('.pac-container')?.children).toHaveLength(0);
  });

  it('waits for two characters before asking Google', async () => {
    attachPlaceSearch({ input, onSelect: () => undefined });
    type(input, 'B');
    await vi.advanceTimersByTimeAsync(300);
    expect(fetchSuggestions).not.toHaveBeenCalled();
  });

  it('selects with the keyboard', async () => {
    fetchSuggestions.mockResolvedValue({
      suggestions: [suggestion('Mysuru', 'Karnataka, India'), suggestion('Mangaluru', 'Karnataka')],
    });
    const picked: PlaceChoice[] = [];
    attachPlaceSearch({ input, onSelect: (place) => picked.push(place) });

    type(input, 'My');
    await vi.advanceTimersByTimeAsync(300);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    await vi.advanceTimersByTimeAsync(0);

    expect(picked).toHaveLength(1);
  });

  it('says so when Google refuses the request instead of failing silently', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchSuggestions.mockRejectedValue(new Error('PERMISSION_DENIED'));
    attachPlaceSearch({ input, onSelect: () => undefined });

    type(input, 'Ban');
    await vi.advanceTimersByTimeAsync(300);

    expect(document.querySelector('.pac-container')?.textContent).toContain(
      'Places API (New)',
    );
  });

  it('removes its list on cleanup', () => {
    const detach = attachPlaceSearch({ input, onSelect: () => undefined });
    expect(document.querySelector('.pac-container')).not.toBeNull();
    detach();
    expect(document.querySelector('.pac-container')).toBeNull();
  });
});
