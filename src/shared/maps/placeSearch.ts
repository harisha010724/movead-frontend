/**
 * Place search on top of Places API (New).
 *
 * The old `google.maps.places.Autocomplete` widget is a "legacy" API. Google
 * does not enable it on Cloud projects created after March 2025, so on a fresh
 * key it fails with `LegacyApiNotActivatedMapError` and the search box silently
 * does nothing. `AutocompleteSuggestion` is the supported replacement, but it is
 * data only: there is no widget, so this draws the suggestion list itself.
 *
 * The list reuses the `.pac-container` / `.pac-item` class names on purpose.
 * `index.css` already styles them to match the app's popovers, restores pointer
 * events inside a modal dialog, and `Dialog` treats a `.pac-container` as part of
 * the dialog rather than an outside click.
 */

export interface PlaceChoice {
  placeId: string;
  name: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  /** Same shape `cityFromPlace` already reads. */
  addressComponents: Array<{ long_name: string; types: string[] }>;
}

export interface PlaceSearchOptions {
  input: HTMLInputElement;
  /** Places API (New) type filter. `(cities)` limits suggestions to cities. */
  includedPrimaryTypes?: string[];
  /** Nudges results towards what the map is showing. */
  getBias?: () => google.maps.LatLngBounds | null | undefined;
  onSelect: (place: PlaceChoice) => void;
}

const DEBOUNCE_MS = 180;
const MIN_CHARS = 2;
const MAX_ROWS = 5;

let instanceCounter = 0;

interface Row {
  prediction: google.maps.places.PlacePrediction;
  el: HTMLElement;
}

function renderHighlighted(
  target: HTMLElement,
  text: string,
  matches: google.maps.places.StringRange[] | undefined,
): void {
  target.textContent = '';
  let cursor = 0;
  for (const match of matches ?? []) {
    if (match.startOffset > cursor) {
      target.append(text.slice(cursor, match.startOffset));
    }
    const strong = document.createElement('span');
    strong.className = 'pac-matched';
    strong.textContent = text.slice(match.startOffset, match.endOffset);
    target.append(strong);
    cursor = match.endOffset;
  }
  if (cursor < text.length) target.append(text.slice(cursor));
}

/** Wires a plain text input to Places suggestions. Returns a cleanup function. */
export function attachPlaceSearch(options: PlaceSearchOptions): () => void {
  const { input, includedPrimaryTypes, getBias, onSelect } = options;
  const listId = `place-search-${++instanceCounter}`;

  const list = document.createElement('div');
  list.id = listId;
  list.className = 'pac-container';
  list.setAttribute('role', 'listbox');
  list.style.position = 'fixed';
  list.style.zIndex = '1000';
  list.style.display = 'none';
  document.body.append(list);

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', listId);
  input.setAttribute('aria-expanded', 'false');

  let rows: Row[] = [];
  let active = -1;
  let timer: number | undefined;
  let requestId = 0;
  let disposed = false;
  let token = new google.maps.places.AutocompleteSessionToken();

  function position(): void {
    const rect = input.getBoundingClientRect();
    list.style.left = `${rect.left}px`;
    list.style.top = `${rect.bottom}px`;
    list.style.width = `${rect.width}px`;
  }

  function open(): void {
    position();
    list.style.display = 'block';
    input.setAttribute('aria-expanded', 'true');
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
  }

  function close(): void {
    list.style.display = 'none';
    list.textContent = '';
    rows = [];
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    window.removeEventListener('resize', position);
    window.removeEventListener('scroll', position, true);
  }

  function showMessage(text: string): void {
    list.textContent = '';
    rows = [];
    active = -1;
    const row = document.createElement('div');
    row.className = 'pac-item';
    row.setAttribute('role', 'option');
    row.setAttribute('aria-disabled', 'true');
    row.style.cursor = 'default';
    row.textContent = text;
    list.append(row);
    open();
  }

  function setActive(next: number): void {
    rows.forEach((row, index) => {
      const on = index === next;
      row.el.classList.toggle('pac-item-selected', on);
      row.el.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    active = next;
    const current = rows[next];
    if (current) input.setAttribute('aria-activedescendant', current.el.id);
    else input.removeAttribute('aria-activedescendant');
  }

  async function choose(index: number): Promise<void> {
    const row = rows[index];
    if (!row) return;
    const used = token;
    // A selection ends the session; the next search starts a fresh, separately billed one.
    token = new google.maps.places.AutocompleteSessionToken();
    try {
      const place = row.prediction.toPlace();
      await place.fetchFields({
        fields: ['id', 'displayName', 'formattedAddress', 'location', 'addressComponents'],
      });
      if (disposed || !place.location) return;
      close();
      onSelect({
        placeId: place.id,
        name: place.displayName ?? '',
        formattedAddress: place.formattedAddress ?? '',
        lat: place.location.lat(),
        lng: place.location.lng(),
        addressComponents: (place.addressComponents ?? []).map((part) => ({
          long_name: part.longText ?? '',
          types: part.types,
        })),
      });
    } catch {
      token = used;
      if (!disposed) showMessage('Could not load that place. Try another.');
    }
  }

  function render(
    suggestions: google.maps.places.AutocompleteSuggestion[],
  ): void {
    list.textContent = '';
    rows = [];
    active = -1;
    input.removeAttribute('aria-activedescendant');

    for (const suggestion of suggestions) {
      const prediction = suggestion.placePrediction;
      if (!prediction) continue;
      const el = document.createElement('div');
      el.id = `${listId}-${rows.length}`;
      el.className = 'pac-item';
      el.setAttribute('role', 'option');
      el.setAttribute('aria-selected', 'false');

      const main = document.createElement('span');
      main.className = 'pac-item-query';
      const mainText = prediction.mainText ?? prediction.text;
      renderHighlighted(main, mainText.text, mainText.matches);
      el.append(main);

      const secondary = prediction.secondaryText?.text;
      if (secondary) {
        const rest = document.createElement('span');
        rest.textContent = ` ${secondary}`;
        el.append(rest);
      }

      const index = rows.length;
      // Keep focus in the input; a click on the list must not blur it first.
      el.addEventListener('mousedown', (event) => event.preventDefault());
      el.addEventListener('click', () => void choose(index));
      el.addEventListener('mousemove', () => {
        if (active !== index) setActive(index);
      });
      list.append(el);
      rows.push({ prediction, el });
    }

    if (rows.length === 0) showMessage('No matching places.');
    else open();
  }

  async function search(query: string): Promise<void> {
    const current = ++requestId;
    try {
      const bounds = getBias?.();
      const { suggestions } =
        await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          sessionToken: token,
          includedRegionCodes: ['in'],
          ...(includedPrimaryTypes ? { includedPrimaryTypes } : {}),
          ...(bounds ? { locationBias: bounds } : {}),
        });
      if (disposed || current !== requestId) return;
      render(suggestions.slice(0, MAX_ROWS));
    } catch (error) {
      if (disposed || current !== requestId) return;
      console.error('Places search failed', error);
      showMessage('Place search is unavailable. Check that Places API (New) is enabled for the key.');
    }
  }

  function onInput(): void {
    window.clearTimeout(timer);
    const query = input.value.trim();
    if (query.length < MIN_CHARS) {
      requestId += 1;
      close();
      return;
    }
    timer = window.setTimeout(() => void search(query), DEBOUNCE_MS);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (list.style.display === 'none' || rows.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((active + 1) % rows.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(active <= 0 ? rows.length - 1 : active - 1);
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      void choose(active);
    } else if (event.key === 'Escape') {
      close();
    }
  }

  function onBlur(): void {
    window.clearTimeout(timer);
    requestId += 1;
    close();
  }

  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onKeyDown);
  input.addEventListener('blur', onBlur);

  return () => {
    disposed = true;
    window.clearTimeout(timer);
    input.removeEventListener('input', onInput);
    input.removeEventListener('keydown', onKeyDown);
    input.removeEventListener('blur', onBlur);
    window.removeEventListener('resize', position);
    window.removeEventListener('scroll', position, true);
    input.removeAttribute('role');
    input.removeAttribute('aria-autocomplete');
    input.removeAttribute('aria-controls');
    input.removeAttribute('aria-expanded');
    input.removeAttribute('aria-activedescendant');
    list.remove();
  };
}
