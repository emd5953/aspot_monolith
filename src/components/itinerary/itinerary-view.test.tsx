import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ItineraryView } from './itinerary-view';

/**
 * The "Tidy route" affordance is the user-facing payoff of the proximity work:
 * it must appear only on a day that is spread out AND has >=3 located stops
 * (the same `canTidyDay` gate the endpoint enforces), and clicking it must ask
 * the parent to tidy the active day.
 */

// The map hits the Google Maps JS loader on mount — irrelevant here.
vi.mock('./itinerary-map', () => ({
  ItineraryMap: () => <div data-testid="map" />,
}));

interface TestActivity {
  id: string;
  title: string;
  description: string;
  category: string;
  sortOrder: number;
  locationCoords?: { lat: number; lng: number };
}

function makeActivity(
  id: string,
  coords?: { lat: number; lng: number }
): TestActivity {
  return {
    id,
    title: `Stop ${id}`,
    description: 'A stop',
    category: 'sightseeing',
    sortOrder: Number(id.replace(/\D/g, '')) || 0,
    locationCoords: coords,
  };
}

function makeItinerary(activities: TestActivity[]) {
  return {
    id: 'it1',
    title: 'NYC Weekend',
    destination: 'New York',
    startDate: new Date('2026-08-01'),
    endDate: new Date('2026-08-02'),
    status: 'draft',
    days: [
      {
        id: 'day1',
        dayNumber: 1,
        date: new Date('2026-08-01'),
        activities,
      },
    ],
  };
}

// ~22km hops (0.2° latitude ≈ 22km): well past the 15km spread threshold.
const zigZag = [
  makeActivity('a1', { lat: 40.7, lng: -74.0 }),
  makeActivity('a2', { lat: 40.9, lng: -74.0 }),
  makeActivity('a3', { lat: 40.71, lng: -74.0 }),
];

// All stops within ~1km: tight day, no hint at all.
const tight = [
  makeActivity('a1', { lat: 40.7, lng: -74.0 }),
  makeActivity('a2', { lat: 40.705, lng: -74.0 }),
  makeActivity('a3', { lat: 40.71, lng: -74.0 }),
];

// Spread out but only two located stops: hint yes, tidy no.
const spreadButTwoLocated = [
  makeActivity('a1', { lat: 40.7, lng: -74.0 }),
  makeActivity('a2', { lat: 40.9, lng: -74.0 }),
  makeActivity('a3'),
];

describe('ItineraryView "Tidy route" affordance', () => {
  it('offers Tidy route on a spread-out day with 3+ located stops', () => {
    render(
      <ItineraryView itinerary={makeItinerary(zigZag)} onTidyDay={() => {}} />
    );
    expect(screen.getByText(/covers a lot of ground/)).toBeInTheDocument();
    expect(screen.getByText('Tidy route')).toBeInTheDocument();
  });

  it('shows no hint or button on a tight day', () => {
    render(
      <ItineraryView itinerary={makeItinerary(tight)} onTidyDay={() => {}} />
    );
    expect(screen.queryByText(/covers a lot of ground/)).not.toBeInTheDocument();
    expect(screen.queryByText('Tidy route')).not.toBeInTheDocument();
  });

  it('shows the hint but no button when fewer than 3 stops are located', () => {
    render(
      <ItineraryView
        itinerary={makeItinerary(spreadButTwoLocated)}
        onTidyDay={() => {}}
      />
    );
    expect(screen.getByText(/covers a lot of ground/)).toBeInTheDocument();
    expect(screen.queryByText('Tidy route')).not.toBeInTheDocument();
  });

  it('hides the button when no onTidyDay handler is wired', () => {
    render(<ItineraryView itinerary={makeItinerary(zigZag)} />);
    expect(screen.getByText(/covers a lot of ground/)).toBeInTheDocument();
    expect(screen.queryByText('Tidy route')).not.toBeInTheDocument();
  });

  it('asks the parent to tidy the active day on click', async () => {
    const onTidyDay = vi.fn().mockResolvedValue(undefined);
    render(
      <ItineraryView itinerary={makeItinerary(zigZag)} onTidyDay={onTidyDay} />
    );
    fireEvent.click(screen.getByText('Tidy route'));
    await waitFor(() => expect(onTidyDay).toHaveBeenCalledWith('day1'));
  });
});
