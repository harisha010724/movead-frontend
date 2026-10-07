import { describe, expect, it } from 'vitest';

import { cityFromPlace } from './cityFromPlace';

describe('cityFromPlace', () => {
  it('prefers the locality over the neighbourhood Google named the place', () => {
    expect(
      cityFromPlace({
        name: 'Indiranagar',
        address_components: [
          { long_name: 'Indiranagar', types: ['sublocality', 'sublocality_level_1'] },
          { long_name: 'Bengaluru', types: ['locality', 'political'] },
          { long_name: 'Karnataka', types: ['administrative_area_level_1', 'political'] },
        ],
      }),
    ).toBe('Bengaluru');
  });

  it('falls back to the place name when Google sent no locality', () => {
    expect(cityFromPlace({ name: 'Mysuru', formatted_address: 'Mysuru, Karnataka' })).toBe(
      'Mysuru',
    );
  });
});
