import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { VehicleAdPreview } from './VehicleAdPreview';
import { viewsFor, wrapPanelsFor } from './vehiclePreview';

function open360() {
  fireEvent.click(screen.getByRole('button', { name: /view 360/i }));
}

describe('wrap coverage', () => {
  it('paints only the doors on a 180 cab wrap', () => {
    expect(wrapPanelsFor('CAB', 'WRAP_180')).toEqual(['doors']);
    expect(viewsFor('CAB', 'WRAP_180')).toEqual(['side']);
  });

  it('paints hood, sides and rear on an auto full wrap', () => {
    expect(wrapPanelsFor('AUTO', 'FULL_WRAP')).toEqual(['hood', 'side', 'rear']);
    expect(viewsFor('AUTO', 'FULL_WRAP')).toEqual(['front', 'side', 'rear']);
  });

  it('paints the cargo box on a tempo side panel', () => {
    expect(wrapPanelsFor('TEMPO', 'SIDE_PANEL')).toEqual(['side']);
    expect(viewsFor('TEMPO', 'SIDE_PANEL')).toEqual(['side']);
  });
});

describe('the vehicle preview', () => {
  it('names the vehicle on the card and opens the turntable in a dialog', () => {
    render(<VehicleAdPreview vehicleType="AUTO" adDimension="HOOD" />);

    expect(screen.getByTestId('vehicle-ad-preview')).toHaveAttribute('data-vehicle', 'AUTO');
    expect(screen.getByText('Vehicle wrap')).toBeInTheDocument();
    expect(screen.getByText(/Auto · Hood · 24 × 18 in/)).toBeInTheDocument();
    expect(screen.queryByTestId('vehicle-spin')).not.toBeInTheDocument();

    open360();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/360 preview/i)).toBeInTheDocument();
  });

  it('starts on the side and wraps the hood when the advertiser turns to the front', () => {
    render(<VehicleAdPreview vehicleType="AUTO" adDimension="HOOD" />);
    open360();

    const spin = screen.getByTestId('vehicle-spin');
    expect(spin).toHaveAttribute('data-frame', 'side');
    expect(spin).toHaveAttribute('data-wrapped', 'false');
    expect(spin.querySelector('img')?.getAttribute('src')).toBe('/vehicles/auto.jpg');

    fireEvent.click(screen.getByRole('button', { name: 'Front' }));

    expect(spin).toHaveAttribute('data-frame', 'front');
    expect(spin).toHaveAttribute('data-wrapped', 'true');
    expect(spin.querySelector('img')?.getAttribute('src')).toBe('/vehicles/auto-wrap-front.jpg');
  });

  it('turns through wrapped frames on a bus side panel', () => {
    render(<VehicleAdPreview vehicleType="BUS" adDimension="SIDE_PANEL" />);
    open360();

    const spin = screen.getByTestId('vehicle-spin');
    expect(screen.getByTestId('vehicle-ad-preview')).toHaveAttribute('data-vehicle', 'BUS');
    expect(spin).toHaveAttribute('data-frame', 'side');
    expect(spin).toHaveAttribute('data-wrapped', 'true');
    expect(spin.querySelector('img')?.getAttribute('src')).toBe('/vehicles/bus-wrap-side.jpg');

    fireEvent.click(screen.getByRole('button', { name: 'Turn left' }));

    expect(spin).toHaveAttribute('data-frame', 'front-right');
    expect(spin.querySelector('img')?.getAttribute('src')).toBe('/vehicles/bus-wrap-front-right.jpg');
  });
});
