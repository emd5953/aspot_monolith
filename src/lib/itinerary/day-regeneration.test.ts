import { describe, it, expect } from 'vitest';
import { buildReplacementActivityRows } from './day-regeneration-service';

/**
 * Regression guard: regenerating a day used to insert activities with no
 * start_time/end_time, stripping the day's schedule. buildReplacementActivityRows
 * must assign sequential clock times (the AI emits none) and map the fields.
 */

describe('buildReplacementActivityRows', () => {
  it('assigns sequential times (90-min default + 20-min gaps from 09:00)', () => {
    const rows = buildReplacementActivityRows(
      'day-1',
      [
        { name: 'Museum' },
        { name: 'Lunch' },
        { name: 'Park' },
      ],
      'Regenerated: "more art"'
    );

    expect(rows.map((r) => [r.start_time, r.end_time])).toEqual([
      ['09:00', '10:30'],
      ['10:50', '12:20'],
      ['12:40', '14:10'],
    ]);
  });

  it('respects per-activity duration when provided', () => {
    const rows = buildReplacementActivityRows('day-1', [{ name: 'Quick stop', duration: 30 }], 'x');
    expect([rows[0].start_time, rows[0].end_time]).toEqual(['09:00', '09:30']);
  });

  it('maps fields, notes, and sort order', () => {
    const rows = buildReplacementActivityRows(
      'day-9',
      [{ name: 'Bar', locationName: 'Main St', category: 'nightlife', estimatedCost: 40 }],
      'Regenerated: "drinks"'
    );
    expect(rows[0]).toMatchObject({
      day_id: 'day-9',
      title: 'Bar',
      location_name: 'Main St',
      category: 'nightlife',
      estimated_cost: 40,
      sort_order: 1,
      notes: 'Regenerated: "drinks"',
    });
  });

  it('falls back to safe defaults for sparse activities', () => {
    const rows = buildReplacementActivityRows('d', [{}], 'note');
    expect(rows[0]).toMatchObject({
      title: 'Activity',
      category: 'activity',
      estimated_cost: null,
      booking_url: null,
    });
  });
});
