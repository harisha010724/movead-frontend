import { describe, expect, it } from 'vitest';

import { defaultAdDimension, isAdDimensionFor, vehicleTypeLabel } from './vehicleCatalog';

describe('vehicle catalog', () => {
  it('names the Indian transit types Wrap2Earn sells', () => {
    expect(vehicleTypeLabel('AUTO')).toBe('Auto');
    expect(vehicleTypeLabel('CAB')).toBe('Car / cab');
    expect(vehicleTypeLabel('BUS')).toBe('Bus');
    expect(vehicleTypeLabel('TRUCK')).toBe('Truck');
    expect(vehicleTypeLabel('TEMPO')).toBe('Tempo / delivery van');
  });

  it('keeps Wrapify 180–360 wraps on cabs only', () => {
    expect(isAdDimensionFor('CAB', 'WRAP_180')).toBe(true);
    expect(isAdDimensionFor('BUS', 'WRAP_180')).toBe(false);
    expect(isAdDimensionFor('TEMPO', 'SIDE_PANEL')).toBe(true);
    expect(defaultAdDimension('AUTO')).toBe('HOOD');
  });
});
