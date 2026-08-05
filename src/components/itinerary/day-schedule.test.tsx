import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DaySchedule } from './day-schedule';

/**
 * Reordering on desktop is HTML5 drag-and-drop, which fires nothing on touch.
 * These cover the button path that replaces it below `md` — the one that
 * decides whether a phone can reorder a day at all.
 */

const activities = [
  { id: 'a1', title: 'Breakfast', description: '', category: 'food', sortOrder: 1 },
  { id: 'a2', title: 'Museum', description: '', category: 'activity', sortOrder: 2 },
  { id: 'a3', title: 'Dinner', description: '', category: 'food', sortOrder: 3 },
];

function renderDay(onReorder?: (ids: string[]) => void) {
  return render(
    <DaySchedule
      dayNumber={1}
      date={new Date('2026-08-04T12:00:00Z')}
      activities={activities}
      onReorder={onReorder}
    />
  );
}

describe('DaySchedule touch reordering', () => {
  it('moves an activity later and reports the new id order', () => {
    const onReorder = vi.fn();
    renderDay(onReorder);

    fireEvent.click(screen.getByLabelText('Move Breakfast later'));

    expect(onReorder).toHaveBeenCalledWith(['a2', 'a1', 'a3']);
  });

  it('moves an activity earlier and reports the new id order', () => {
    const onReorder = vi.fn();
    renderDay(onReorder);

    fireEvent.click(screen.getByLabelText('Move Dinner earlier'));

    expect(onReorder).toHaveBeenCalledWith(['a1', 'a3', 'a2']);
  });

  it('disables the out-of-range directions at each end', () => {
    renderDay(vi.fn());

    expect(screen.getByLabelText('Move Breakfast earlier')).toBeDisabled();
    expect(screen.getByLabelText('Move Dinner later')).toBeDisabled();
    expect(screen.getByLabelText('Move Museum earlier')).toBeEnabled();
    expect(screen.getByLabelText('Move Museum later')).toBeEnabled();
  });

  it('renders no reorder controls when the day is not reorderable', () => {
    renderDay(undefined);

    expect(screen.queryByLabelText('Move Breakfast later')).not.toBeInTheDocument();
  });
});
