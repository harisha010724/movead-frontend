import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CampaignDraftPreview } from './CampaignDraftPreview';

describe('the campaign draft preview', () => {
  it('stays empty until the advertiser types something', () => {
    render(<CampaignDraftPreview values={{ vehicleType: 'CAB' }} farthestStepId="details" />);

    expect(screen.getByText(/Start with the campaign name/)).toBeInTheDocument();
    expect(screen.queryByText('View 360°')).not.toBeInTheDocument();
    expect(screen.queryByText('City')).not.toBeInTheDocument();
    expect(screen.queryByText('Not selected')).not.toBeInTheDocument();
  });

  it('shows the name and brand as soon as they are typed, and not the wrap yet', () => {
    render(
      <CampaignDraftPreview
        farthestStepId="details"
        values={{ name: 'ABC Summer Sale', brandName: 'ABC Retail', vehicleType: 'CAB' }}
      />,
    );

    expect(screen.getByText('ABC Summer Sale')).toBeInTheDocument();
    expect(screen.getByText('ABC Retail')).toBeInTheDocument();
    expect(screen.queryByText('View 360°')).not.toBeInTheDocument();
    expect(screen.queryByText('Dates')).not.toBeInTheDocument();
  });

  it('adds the wrap once the vehicle step is reached', () => {
    render(
      <CampaignDraftPreview
        farthestStepId="vehicle"
        values={{
          name: 'ABC Summer Sale',
          brandName: 'ABC Retail',
          vehicleType: 'CAB',
          adDimension: 'WRAP_180',
        }}
      />,
    );

    expect(screen.getByText('View 360°')).toBeInTheDocument();
    expect(screen.getAllByText('Vehicle wrap').length).toBeGreaterThan(0);
    expect(screen.queryByText('City')).not.toBeInTheDocument();
    expect(screen.queryByText('Kilometres')).not.toBeInTheDocument();
  });

  it('adds city and dates only after those inputs are filled', () => {
    render(
      <CampaignDraftPreview
        farthestStepId="plan"
        values={{
          name: 'ABC Summer Sale',
          city: 'Bengaluru',
          vehicleType: 'CAB',
          adDimension: 'WRAP_180',
          startDate: '2026-10-10',
          endDate: '2026-10-20',
          zonePrimeKm: '1000',
        }}
      />,
    );

    expect(screen.getByText('Bengaluru')).toBeInTheDocument();
    expect(screen.getByText('Dates')).toBeInTheDocument();
    expect(screen.getByText('Kilometres')).toBeInTheDocument();
    expect(screen.queryByText('Locations')).not.toBeInTheDocument();
  });

  it('lists each dropped pin once the locations step is reached', () => {
    render(
      <CampaignDraftPreview
        farthestStepId="locations"
        values={{
          name: 'ABC Summer Sale',
          locations: [
            {
              id: 'pin_1',
              placeId: 'p1',
              label: 'Koramangala',
              lat: 12.93,
              lng: 77.62,
              tier: 'prime',
            },
          ],
        }}
      />,
    );

    expect(screen.getByTestId('location-pin-list')).toBeInTheDocument();
    expect(screen.getByText('Koramangala')).toBeInTheDocument();
    expect(screen.getByText('1 pin')).toBeInTheDocument();
  });
});
