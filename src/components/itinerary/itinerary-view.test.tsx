import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ItineraryView } from './itinerary-view';

/**
 * The Move-list is one flat, user-orderable run of stops.
 *
 * The previous suite here covered the "Tidy route" affordance — a per-day
 * geographic fix that went away with days. What matters now is that the list
 * renders in `sortOrder` and that a manual reorder reaches the parent, since
 * the user's arrangement is what overrides generation's start-time ordering.
 */

// The map hits the Google Maps JS loader on mount — irrelevant here.
vi.mock('./itinerary-map', () => ({
  ItineraryMap: () => <div data-testid="map" />,
}));

interface TestPlan {
  id: string;
  title: string;
  description: string;
  category: string;
  sortOrder: number;
  startTime?: string;
  locationCoords?: { lat: number; lng: number };
}

function makePlan(id: string, sortOrder: number, startTime?: string): TestPlan {
  return {
    id,
    title: `Stop ${id}`,
    description: 'A stop',
    category: 'activity',
    sortOrder,
    startTime,
  };
}

function makeItinerary(plans: TestPlan[]) {
  return {
    id: 'it1',
    title: 'Tonight',
    destination: 'New York',
    startDate: new Date('2026-08-01'),
    endDate: new Date('2026-08-01'),
    status: 'draft',
    plans,
  };
}

const threeStops = [
  makePlan('a1', 1, '19:30'),
  makePlan('a2', 2, '22:00'),
  makePlan('a3', 3),
];

describe('ItineraryView — the Move-list', () => {
  it('renders every plan as one flat list', () => {
    render(<ItineraryView itinerary={makeItinerary(threeStops)} />);
    expect(screen.getByText('Stop a1')).toBeInTheDocument();
    expect(screen.getByText('Stop a2')).toBeInTheDocument();
    expect(screen.getByText('Stop a3')).toBeInTheDocument();
  });

  it('shows no day tabs — there is only one night', () => {
    render(<ItineraryView itinerary={makeItinerary(threeStops)} />);
    expect(screen.queryByText(/^Day \d/)).not.toBeInTheDocument();
  });

  it('renders in sortOrder, not array order', () => {
    // Deliberately out of order: sortOrder is the contract, and it is what a
    // manual drag rewrites.
    const shuffled = [makePlan('c', 3), makePlan('a', 1), makePlan('b', 2)];
    render(<ItineraryView itinerary={makeItinerary(shuffled)} />);
    const titles = screen.getAllByText(/^Stop /).map((n) => n.textContent);
    expect(titles).toEqual(['Stop a', 'Stop b', 'Stop c']);
  });

  it('hands a reordered set of ids to the parent', () => {
    const onReorderActivities = vi.fn();
    render(
      <ItineraryView
        itinerary={makeItinerary(threeStops)}
        onReorderActivities={onReorderActivities}
      />
    );
    // The touch path: move the first stop one position later.
    fireEvent.click(screen.getByLabelText('Move Stop a1 later'));
    expect(onReorderActivities).toHaveBeenCalledWith(['a2', 'a1', 'a3']);
  });

  it('offers no reorder affordance on a read-only (shared) view', () => {
    render(<ItineraryView itinerary={makeItinerary(threeStops)} />);
    expect(screen.queryByLabelText(/later$/i)).not.toBeInTheDocument();
  });

  it('renders an empty list without crashing', () => {
    render(<ItineraryView itinerary={makeItinerary([])} />);
    expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument();
  });
});
