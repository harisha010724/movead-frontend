import { useEffect, useRef } from 'react';
import { env } from '@/shared/config/env';
import { cn } from '@/shared/lib/cn';
import { Field, controlClass, controlHeight, controlInvalidClass, describedBy, useFieldIds } from '@/shared/ui/form';
import { cityFromPlace } from './cityFromPlace';
import { rememberCityCenter } from './cities';
import { loadGoogleMaps } from './loadGoogleMaps';

/**
 * Google Places city search. The advertiser types; they pick one Indian city.
 * Free text is not stored — only a selected place becomes the campaign city.
 */
export function CityAutocomplete({
  label = 'City',
  value,
  onChange,
  onBlur,
  error,
  hint = 'Search and pick an Indian city. One city per campaign.',
  required,
  disabled,
}: {
  label?: string;
  value: string;
  onChange: (city: string) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const apiKey = env.googleMapsApiKey;
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  const { id, hintId, errorId } = useFieldIds();

  onChangeRef.current = onChange;

  useEffect(() => {
    if (!apiKey || !inputRef.current || disabled) return;

    let autocomplete: google.maps.places.Autocomplete | null = null;
    let cancelled = false;

    void loadGoogleMaps(apiKey).then(() => {
      if (cancelled || !inputRef.current) return;

      autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['(cities)'],
        fields: ['address_components', 'formatted_address', 'geometry', 'name'],
        componentRestrictions: { country: 'in' },
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete?.getPlace();
        if (!place) return;
        const city = cityFromPlace(place);
        if (!city) return;
        const loc = place.geometry?.location;
        if (loc) rememberCityCenter(city, loc.lat(), loc.lng());
        onChangeRef.current(city);
        if (inputRef.current) inputRef.current.value = city;
      });
    });

    return () => {
      cancelled = true;
      if (autocomplete) google.maps.event.clearInstanceListeners(autocomplete);
    };
  }, [apiKey, disabled]);

  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value;
    }
  }, [value]);

  return (
    <Field
      label={label}
      htmlFor={id}
      hintId={hintId}
      errorId={errorId}
      hint={hint}
      {...(error !== undefined ? { error } : {})}
      {...(required !== undefined ? { required } : {})}
    >
      <input
        ref={inputRef}
        id={id}
        type="text"
        autoComplete="off"
        required={required}
        disabled={disabled}
        defaultValue={value}
        placeholder="Search for a city"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy({
          hintId,
          errorId,
          hasHint: Boolean(hint),
          hasError: Boolean(error),
        })}
        onBlur={() => {
          if (inputRef.current && inputRef.current.value !== value) {
            inputRef.current.value = value;
          }
          onBlur?.();
        }}
        className={cn(controlClass, controlHeight, error && controlInvalidClass)}
      />
    </Field>
  );
}
