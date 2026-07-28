import { describe, it, expect } from 'vitest';
import { repairPlan, sortBucketChronologically } from './plan-repair';
import type { ItineraryPlan, ResearchResult, ScheduledItem } from './types';
import type { DayPool } from './pool-partition';
import type { WeeklyHours } from '@/lib/maps/place-verification';

/**
 * Repair is the fix half of the audit. Every case here is one the audit already
 * detects and the old pipeline shipped anyway, because acting on a finding
 * required a revision round-trip that fast mode never reaches.
 */

const item = (name: string, over: Partial<ScheduledItem> = {}): ScheduledItem => ({
  time: '10:00',
  name,
  type: 'attraction',
  duration: 90,
  ...over,
});

/** 2026-09-14 is a Monday, so day 1 of this fixture is a Monday. */
function plan(days: Partial<ItineraryPlan['days'][number]>[]): ItineraryPlan {
  return {
    destination: 'Testville',
    summary: 'test',
    totalEstimatedCost: '$$',
    days: days.map((d, i) => ({
      dayNumber: d.dayNumber ?? i + 1,
      date: `2026-09-${14 + i}`,
      morning: d.morning ?? [item(`M${i}`)],
      afternoon: d.afternoon ?? [item(`A${i}`, { time: '14:00' })],
      evening: d.evening ?? [item(`E${i}`, { time: '19:00', type: 'restaurant' })],
      notes: '',
      estimatedCost: '$$',
      theme: d.theme,
    })),
  };
}

function research(
  hours: Array<{ name: string; openingHours: WeeklyHours }> = []
): ResearchResult {
  return {
    destination: 'Testville',
    attractions: hours.map((h) => ({
      name: h.name,
      description: '',
      category: 'x',
      estimatedDuration: 90,
      priceRange: '$$',
      openingHours: h.openingHours,
    })),
    restaurants: [],
    activities: [],
    localInsights: [],
    sources: [],
  };
}

function pool(names: string[] = []): DayPool {
  return {
    attractions: names.map((n) => ({
      name: n,
      description: '',
      category: 'x',
      estimatedDuration: 90,
      priceRange: '$$',
    })),
    restaurants: [],
    activities: [],
  };
}

const emptyPools = (n: number): DayPool[] => Array.from({ length: n }, () => pool());

describe('sortBucketChronologically', () => {
  it('orders a backwards bucket', () => {
    const sorted = sortBucketChronologically([
      item('late', { time: '15:00' }),
      item('early', { time: '09:00' }),
    ]);
    expect(sorted.map((i) => i.name)).toEqual(['early', 'late']);
  });

  it('keeps unparseable times at the end instead of dropping them', () => {
    const sorted = sortBucketChronologically([
      item('no-time', { time: 'whenever' }),
      item('timed', { time: '09:00' }),
    ]);
    expect(sorted.map((i) => i.name)).toEqual(['timed', 'no-time']);
  });

  it('is stable for equal times', () => {
    const sorted = sortBucketChronologically([
      item('first', { time: '09:00' }),
      item('second', { time: '09:00' }),
    ]);
    expect(sorted.map((i) => i.name)).toEqual(['first', 'second']);
  });
});

describe('repairPlan — duplicates', () => {
  it('drops a venue already booked on an earlier day, keeping the first', () => {
    const { plan: fixed, repairs } = repairPlan(
      plan([
        { afternoon: [item('The Bluebird Cafe', { time: '14:00' })] },
        { afternoon: [item('Bluebird Cafe', { time: '14:00' })] },
      ]),
      research(),
      emptyPools(2)
    );

    expect(fixed.days[0].afternoon.map((i) => i.name)).toEqual(['The Bluebird Cafe']);
    expect(fixed.days[1].afternoon.map((i) => i.name)).not.toContain('Bluebird Cafe');
    expect(repairs.some((r) => r.includes('duplicate'))).toBe(true);
  });

  it('replaces the dropped duplicate from that day\'s own pool', () => {
    const { plan: fixed } = repairPlan(
      plan([
        { afternoon: [item('Repeat', { time: '14:00' })] },
        { afternoon: [item('Repeat', { time: '14:00' })] },
      ]),
      research(),
      [pool(), pool(['Fresh Option'])]
    );

    expect(fixed.days[1].afternoon.map((i) => i.name)).toEqual(['Fresh Option']);
  });
});

describe('repairPlan — opening hours', () => {
  // Open only 18:00–23:00, every day.
  const eveningsOnly: WeeklyHours = Array.from({ length: 7 }, (_, day) => ({
    day,
    open: 18 * 60,
    close: 23 * 60,
  }));

  it('moves a venue scheduled while it is shut into a bucket where it is open', () => {
    const { plan: fixed, repairs } = repairPlan(
      plan([{ morning: [item('Bar Trench', { time: '09:00' })] }]),
      research([{ name: 'Bar Trench', openingHours: eveningsOnly }]),
      emptyPools(1)
    );

    expect(fixed.days[0].morning.map((i) => i.name)).not.toContain('Bar Trench');
    expect(fixed.days[0].evening.map((i) => i.name)).toContain('Bar Trench');
    expect(repairs.some((r) => r.includes('closed at 09:00'))).toBe(true);
  });

  it('restamps the moved item to its new bucket time', () => {
    const { plan: fixed } = repairPlan(
      plan([{ morning: [item('Bar Trench', { time: '09:00' })] }]),
      research([{ name: 'Bar Trench', openingHours: eveningsOnly }]),
      emptyPools(1)
    );

    const moved = fixed.days[0].evening.find((i) => i.name === 'Bar Trench');
    expect(moved?.time).toBe('19:00');
  });

  it('leaves a venue alone when it is open at its scheduled time', () => {
    const { plan: fixed, repairs } = repairPlan(
      plan([{ evening: [item('Bar Trench', { time: '19:00', type: 'restaurant' })] }]),
      research([{ name: 'Bar Trench', openingHours: eveningsOnly }]),
      emptyPools(1)
    );

    expect(fixed.days[0].evening.map((i) => i.name)).toContain('Bar Trench');
    expect(repairs.some((r) => r.includes('closed'))).toBe(false);
  });

  it('treats unknown hours as unknown, not as closed', () => {
    const { repairs } = repairPlan(
      plan([{ morning: [item('Unlisted Bar', { time: '09:00' })] }]),
      research(),
      emptyPools(1)
    );

    expect(repairs.some((r) => r.includes('closed'))).toBe(false);
  });

  // Closed Mondays; the fixture's day 1 is a Monday.
  const closedMonday: WeeklyHours = [0, 2, 3, 4, 5, 6].map((day) => ({
    day,
    open: 9 * 60,
    close: 17 * 60,
  }));

  it('drops a venue that is shut all day and replaces it from the pool', () => {
    const { plan: fixed, repairs } = repairPlan(
      plan([{ morning: [item('Monday Museum', { time: '10:00' })] }]),
      research([{ name: 'Monday Museum', openingHours: closedMonday }]),
      [pool(['Open Alternative'])]
    );

    expect(fixed.days[0].morning.map((i) => i.name)).toEqual(['Open Alternative']);
    expect(repairs.some((r) => r.includes('closed all day'))).toBe(true);
  });

  // "Leave it alone" and "nowhere on this day works" are different answers.
  // Conflating them dropped The High Line and Eataly — both open daily — out
  // of a real NYC plan, because the open case shared a return value with the
  // no-bucket-works case.
  it('does not drop a venue that is open at its scheduled time', () => {
    const openDaily: WeeklyHours = Array.from({ length: 7 }, (_, day) => ({
      day,
      open: 9 * 60,
      close: 22 * 60,
    }));

    const { plan: fixed, repairs } = repairPlan(
      plan([{ morning: [item('The High Line', { time: '10:00' })] }]),
      research([{ name: 'The High Line', openingHours: openDaily }]),
      [pool(['Should Not Be Used'])]
    );

    expect(fixed.days[0].morning.map((i) => i.name)).toEqual(['The High Line']);
    expect(repairs.some((r) => r.includes('closed'))).toBe(false);
  });

  it('judges the item at its own scheduled time, not the bucket default', () => {
    // Open 09:00–11:00 only. The bucket default (10:00) is inside that window,
    // but the item is actually booked at 08:00, which is not.
    const earlyOnly: WeeklyHours = Array.from({ length: 7 }, (_, day) => ({
      day,
      open: 9 * 60,
      close: 11 * 60,
    }));

    const { repairs } = repairPlan(
      plan([{ morning: [item('Narrow Window', { time: '08:00' })] }]),
      research([{ name: 'Narrow Window', openingHours: earlyOnly }]),
      emptyPools(1)
    );

    expect(repairs.some((r) => r.includes('closed'))).toBe(true);
  });

  it('never refills with a candidate that is itself shut at that hour', () => {
    // Repair once filled an empty NYC morning with a bar opening at 17:00,
    // trading an "empty bucket" finding for a worse "closed when scheduled" one.
    const eveningOnly: WeeklyHours = Array.from({ length: 7 }, (_, day) => ({
      day,
      open: 17 * 60,
      close: 23 * 60,
    }));

    const { plan: fixed } = repairPlan(
      plan([{ morning: [] }]),
      research([{ name: 'Left Bank', openingHours: eveningOnly }]),
      [pool(['Left Bank'])]
    );

    expect(fixed.days[0].morning).toHaveLength(0);
  });
});

describe('repairPlan — empty buckets', () => {
  it('refills an empty bucket from the day pool', () => {
    const { plan: fixed, repairs } = repairPlan(
      plan([{ afternoon: [] }]),
      research(),
      [pool(['Backup Attraction'])]
    );

    expect(fixed.days[0].afternoon.map((i) => i.name)).toEqual(['Backup Attraction']);
    expect(repairs.some((r) => r.includes('filled the afternoon'))).toBe(true);
  });

  it('never refills with a venue already used elsewhere in the trip', () => {
    const { plan: fixed } = repairPlan(
      plan([{ morning: [item('Only Option')] }, { afternoon: [] }]),
      research(),
      [pool(), pool(['Only Option'])]
    );

    expect(fixed.days[1].afternoon).toHaveLength(0);
  });

  it('leaves the bucket empty when the pool is exhausted', () => {
    const { plan: fixed } = repairPlan(plan([{ afternoon: [] }]), research(), emptyPools(1));
    expect(fixed.days[0].afternoon).toHaveLength(0);
  });
});

describe('repairPlan — chronology', () => {
  it('re-sorts a bucket that runs backwards', () => {
    const { plan: fixed, repairs } = repairPlan(
      plan([
        {
          morning: [item('second', { time: '11:00' }), item('first', { time: '09:00' })],
        },
      ]),
      research(),
      emptyPools(1)
    );

    expect(fixed.days[0].morning.map((i) => i.name)).toEqual(['first', 'second']);
    expect(repairs.some((r) => r.includes('re-sorted'))).toBe(true);
  });
});

describe('repairPlan — invariants', () => {
  it('is idempotent — repairing a repaired plan changes nothing further', () => {
    const input = plan([
      { morning: [item('b', { time: '11:00' }), item('a', { time: '09:00' })] },
      { afternoon: [item('a', { time: '14:00' })] },
    ]);
    const once = repairPlan(input, research(), emptyPools(2));
    const twice = repairPlan(once.plan, research(), emptyPools(2));

    expect(twice.repairs).toEqual([]);
    expect(twice.plan).toEqual(once.plan);
  });

  it('does not mutate the input plan', () => {
    const input = plan([
      { morning: [item('b', { time: '11:00' }), item('a', { time: '09:00' })] },
    ]);
    const snapshot = JSON.parse(JSON.stringify(input));
    repairPlan(input, research(), emptyPools(1));

    expect(input).toEqual(snapshot);
  });

  it('never drops a day', () => {
    const { plan: fixed } = repairPlan(plan([{}, {}, {}]), research(), emptyPools(3));
    expect(fixed.days).toHaveLength(3);
  });
});

/**
 * Meals are the scaffold a day hangs off, not extras the planner may skip.
 * Measured across the five real research pools, 17 of 20 generated days had no
 * lunch at all — dinner only appeared because the evening refill happens to
 * prefer restaurants.
 */
describe('repairPlan — meals are defaults', () => {
  const withRestaurants = (names: string[]): DayPool => ({
    attractions: [],
    restaurants: names.map((n) => ({ name: n, cuisine: ['local'], priceRange: '$$' })),
    activities: [],
  });

  it('adds lunch when the day has none', () => {
    const { plan: fixed, repairs } = repairPlan(
      plan([{ afternoon: [item('Museum', { time: '14:00' })] }]),
      research(),
      [withRestaurants(['Midday Spot'])]
    );

    const lunch = fixed.days[0].afternoon.find((i) => i.name === 'Midday Spot');
    expect(lunch?.type).toBe('restaurant');
    expect(lunch?.time).toBe('13:00');
    expect(repairs.some((r) => r.includes('added lunch'))).toBe(true);
  });

  it('adds dinner when the day has none', () => {
    const { plan: fixed, repairs } = repairPlan(
      plan([{ evening: [item('Night Walk', { time: '19:00' })] }]),
      research(),
      [withRestaurants(['Spot A', 'Spot B'])]
    );

    const dinner = fixed.days[0].evening.find(
      (i) => i.type === 'restaurant' && i.time === '19:00'
    );
    expect(dinner).toBeDefined();
    expect(repairs.some((r) => r.includes('added dinner'))).toBe(true);
  });

  it('does not add a second lunch when one is already booked', () => {
    const { repairs } = repairPlan(
      plan([{ afternoon: [item('Already Eating', { type: 'restaurant', time: '12:30' })] }]),
      research(),
      [withRestaurants(['Should Not Be Used'])]
    );
    expect(repairs.some((r) => r.includes('added lunch'))).toBe(false);
  });

  // A 22:00 bar is not dinner. The old check was bucket-based and counted it.
  it('does not count a late-night stop as dinner', () => {
    const { repairs } = repairPlan(
      plan([{ evening: [item('Late Bar', { type: 'restaurant', time: '23:30' })] }]),
      research(),
      [withRestaurants(['Lunch Spot', 'Actual Dinner'])]
    );
    expect(repairs.some((r) => r.includes('added dinner'))).toBe(true);
  });

  it('never books the same restaurant for lunch and dinner', () => {
    const { plan: fixed } = repairPlan(
      plan([{ afternoon: [], evening: [] }]),
      research(),
      [withRestaurants(['Only One'])]
    );
    const all = [...fixed.days[0].afternoon, ...fixed.days[0].evening];
    expect(all.filter((i) => i.name === 'Only One')).toHaveLength(1);
  });

  // Meals are filled dinner-first, so a scarce pool feeds the evening. One
  // sit-down meal in a day should be dinner, not a 13:00 lunch that leaves
  // the evening empty.
  it('spends the last restaurant on dinner rather than lunch', () => {
    const { plan: fixed } = repairPlan(
      plan([{ afternoon: [], evening: [] }]),
      research(),
      [withRestaurants(['Only One'])]
    );
    expect(fixed.days[0].evening.some((i) => i.name === 'Only One')).toBe(true);
    expect(fixed.days[0].afternoon.some((i) => i.name === 'Only One')).toBe(false);
  });

  it('skips the meal rather than inventing one when no restaurant is available', () => {
    const { repairs } = repairPlan(
      plan([{ afternoon: [item('Museum', { time: '14:00' })] }]),
      research(),
      emptyPools(1)
    );
    expect(repairs.some((r) => r.includes('added lunch'))).toBe(false);
  });
});
