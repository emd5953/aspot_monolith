import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BottomTabs } from './bottom-tabs';

const mocks = vi.hoisted(() => ({ pathname: '/dashboard' }));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}));

/**
 * The top nav hides its links below `md`, so this bar is the only navigation a
 * phone has. If it stops rendering all four destinations, three routes become
 * unreachable on mobile.
 */
describe('BottomTabs', () => {
  it('renders every primary destination', () => {
    mocks.pathname = '/dashboard';
    render(<BottomTabs />);

    for (const label of ['Home', 'Itineraries', 'Trips', 'Profile']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('marks the tab matching the current route as current', () => {
    mocks.pathname = '/trips';
    render(<BottomTabs />);

    expect(screen.getByRole('link', { name: /Trips/ })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: /Home/ })).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('keeps the parent tab current on a nested route', () => {
    mocks.pathname = '/itinerary/abc123';
    render(<BottomTabs />);

    expect(screen.getByRole('link', { name: /Itineraries/ })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});
