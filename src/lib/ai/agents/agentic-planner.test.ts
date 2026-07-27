import { describe, it, expect } from 'vitest';
import { removeCrossDayDuplicates } from './agentic-planner';
import type { DayPlan, ScheduledItem } from './types';

const item = (name: string, over: Partial<ScheduledItem> = {}): ScheduledItem => ({
  time: '10:00',
  name,
  type: 'attraction',
  duration: 90,
  ...over,
});

const day = (dayNumber: number, over: Partial<DayPlan> = {}): DayPlan => ({
  dayNumber,
  date: `2026-09-${10 + dayNumber}`,
  morning: [],
  afternoon: [],
  evening: [],
  notes: '',
  estimatedCost: '$$',
  ...over,
});

describe('removeCrossDayDuplicates', () => {
  it('keeps the first booking and drops the later one', () => {
    const { days, removed } = removeCrossDayDuplicates([
      day(1, { afternoon: [item('The Bluebird Cafe')] }),
      day(2, { afternoon: [item('Bluebird Cafe')] }),
    ]);

    expect(days[0].afternoon.map((i) => i.name)).toEqual(['The Bluebird Cafe']);
    expect(days[1].afternoon).toEqual([]);
    expect(removed).toEqual([{ name: 'Bluebird Cafe', dayNumber: 2 }]);
  });

  it('catches a repeat disguised by a parenthetical qualifier', () => {
    const { days, removed } = removeCrossDayDuplicates([
      day(1, {
        morning: [item('The Bluebird Cafe')],
        evening: [item('The Bluebird Cafe (Evening Show)')],
      }),
    ]);

    expect(days[0].evening).toEqual([]);
    expect(removed).toHaveLength(1);
  });

  it('leaves a clean trip untouched', () => {
    const input = [
      day(1, { morning: [item('A')], evening: [item('B', { type: 'restaurant' })] }),
      day(2, { morning: [item('C')] }),
    ];
    const { days, removed } = removeCrossDayDuplicates(input);

    expect(removed).toEqual([]);
    expect(days.map((d) => d.morning.length + d.evening.length)).toEqual([2, 1]);
  });

  it('reports every name it used, so a refill pass cannot re-add one', () => {
    const { used } = removeCrossDayDuplicates([
      day(1, { morning: [item('The Dead Rabbit')] }),
    ]);
    expect(used.has('dead rabbit')).toBe(true);
  });

  it('drops items with an unusable name instead of keying them all alike', () => {
    const { days } = removeCrossDayDuplicates([
      day(1, { morning: [item('   '), item('Real Place')] }),
    ]);
    expect(days[0].morning.map((i) => i.name)).toEqual(['Real Place']);
  });
});
