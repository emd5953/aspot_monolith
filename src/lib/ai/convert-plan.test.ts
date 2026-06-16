import { describe, it, expect } from 'vitest';
import { convertAgentPlanToDayPlans } from './itinerary-generator';
import type { ItineraryPlan } from './agents/types';

/**
 * Regression guard for the generation core: the planner emits time-ordered
 * items, but those times used to be dropped, leaving every activity timeless.
 * The converter must now stamp each activity with concrete start/end times.
 */

const plan: ItineraryPlan = {
  destination: 'Tokyo',
  summary: 'A test trip',
  totalEstimatedCost: 'Varies',
  days: [
    {
      dayNumber: 1,
      date: '2026-06-20',
      theme: 'Arrival',
      notes: '',
      estimatedCost: 'Varies',
      morning: [{ time: '09:00', name: 'Sensoji Temple', type: 'attraction', duration: 90 }],
      afternoon: [{ time: '12:30', name: 'Sushi lunch', type: 'restaurant', duration: 60 }],
      evening: [{ time: '19:00', name: 'Golden Gai bars', type: 'activity', duration: 120 }],
    },
  ],
};

describe('convertAgentPlanToDayPlans — schedule survives', () => {
  it("stamps each activity with the planner's start time and a computed end", () => {
    const [day] = convertAgentPlanToDayPlans(plan, new Date('2026-06-20T00:00:00Z'));
    expect(day.activities).toHaveLength(3);

    expect(day.activities[0].startTime).toBe('09:00');
    expect(day.activities[0].endTime).toBe('10:30');

    expect(day.activities[1].startTime).toBe('12:30');
    expect(day.activities[1].endTime).toBe('13:30');

    expect(day.activities[2].startTime).toBe('19:00');
    expect(day.activities[2].endTime).toBe('21:00');
  });

  it('keeps the day date aligned to the start date', () => {
    const [day] = convertAgentPlanToDayPlans(plan, new Date('2026-06-20T00:00:00Z'));
    expect(day.dayNumber).toBe(1);
  });
});
