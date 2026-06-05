import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { STORAGE_KEY, type StoredProject } from './types';

const savedProject: StoredProject = {
  version: 1,
  savedAt: '2026-01-01T00:00:00.000Z',
  ui: {
    selectedFeatureId: 'area-1'
  },
  features: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'area-1',
        properties: {
          id: 'area-1',
          name: 'Existing lot',
          measurementType: 'polygon',
          areaSqM: 250,
          perimeterM: 80,
          lengthM: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-80, 35],
              [-80.001, 35],
              [-80.001, 35.001],
              [-80, 35.001],
              [-80, 35]
            ]
          ]
        }
      }
    ]
  }
};

describe('App panel behavior', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv('VITE_MAPBOX_ACCESS_TOKEN', '');
    vi.stubEnv('VITE_ADSENSE_CLIENT_ID', '');
    vi.stubEnv('VITE_ADSENSE_SLOT_PANEL', '');
    window.history.pushState({}, '', '/');
  });

  it('shows the token setup notice when no Mapbox token is configured', () => {
    render(<App />);
    expect(screen.getByText('Mapbox token required')).toBeInTheDocument();
  });

  it('restores saved measurements and lets users rename the selected feature', async () => {
    const user = userEvent.setup();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedProject));

    render(<App />);

    const input = screen.getByLabelText('Measurement name');
    expect(input).toHaveValue('Existing lot');
    await user.clear(input);
    await user.type(input, 'Renamed lot');
    expect(screen.getByText('Renamed lot')).toBeInTheDocument();
  });

  it('renders the privacy policy route for ad and data disclosures', () => {
    window.history.pushState({}, '', '/privacy');

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByText('Advertising data')).toBeInTheDocument();
    expect(screen.getByText('Back to measurement tool')).toBeInTheDocument();
  });

  it('shows sponsor placeholder when ads are not configured', () => {
    render(<App />);

    expect(screen.getByText('Free tool supported by sponsors')).toBeInTheDocument();
    expect(screen.queryByText('Support the free tool')).not.toBeInTheDocument();
  });

  it('shows the property search control disabled until a Mapbox token is configured', () => {
    render(<App />);

    expect(screen.getByLabelText('Find property')).toBeDisabled();
    expect(screen.getByTitle('Search map')).toBeDisabled();
  });

  it('renders the professional measurement guide route', () => {
    window.history.pushState({}, '', '/guide');

    render(<App />);

    expect(screen.getByRole('heading', { name: 'How to Measure Buildings and Parking Lots' })).toBeInTheDocument();
    expect(screen.getByText('Measure parking lots and paved areas')).toBeInTheDocument();
  });

  it('renders the contact route with the configured launch contact placeholder', () => {
    window.history.pushState({}, '', '/contact');

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Contact' })).toBeInTheDocument();
    expect(screen.getByText('Before public launch, set VITE_CONTACT_EMAIL to a monitored site owner email address.')).toBeInTheDocument();
  });
});
