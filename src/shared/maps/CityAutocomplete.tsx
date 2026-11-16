import { useEffect, useRef } from 'react';
import { env } from '@/shared/config/env';
import { cn } from '@/shared/lib/cn';
import { Field, controlClass, controlHeight, controlInvalidClass, describedBy, useFieldIds } from '@/shared/ui/form';
import { cityFromPlace } from './cityFromPlace';
import { rememberCityCenter } from './cities';
import { loadGoogleMaps } from './loadGoogleMaps';
import { attachPlaceSearch } from './placeSearch';

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

    let detach: (() => void) | null = null;
    let cancelled = false;

    void loadGoogleMaps(apiKey).then(() => {
      if (cancelled || !inputRef.current) return;

      detach = attachPlaceSearch({
        input: inputRef.current,
        includedPrimaryTypes: ['(cities)'],
        onSelect: (place) => {
          const city = cityFromPlace({
            name: place.name,
            formatted_address: place.formattedAddress,
            address_components: place.addressComponents,
          });
          if (!city) return;
          rememberCityCenter(city, place.lat, place.lng);
          onChangeRef.current(city);
          if (inputRef.current) inputRef.current.value = city;
        },
      });
    });

    return () => {
      cancelled = true;
      detach?.();
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
