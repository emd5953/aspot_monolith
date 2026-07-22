import { describe, it, expect } from 'vitest';
import { auditPlan } from './plan-audit';
import type { ItineraryPlan, ResearchResult, ScheduledItem } from './types';

/**
 * These cases are drawn from real generations that the LLM reviewer passed:
 * a Nashville plan that booked "The Bluebird Cafe" and "Bluebird Cafe" on
 * consecutive days and scored 92/100, and a Lisbon plan that crossed the city
 * four times in one day and scored 85/100. The audit exists to make those
 * scores impossible.
 */

const item = (name: string, over: Partial<ScheduledItem> = {}): ScheduledItem => ({
  time: '10:00',
  name,
  type: 'attraction',
  duration: 90,
  ...over,
});

function plan(days: Partial<ItineraryPlan['days'][number]>[]): ItineraryPlan {
  return {
    destination: 'Testville',
    summary: 'test',
    totalEstimatedCost: '$$',
    days: days.map((d, i) => ({
      dayNumber: d.dayNumber ?? i + 1,
      date: `2026-09-${10 + i}`,
      morning: d.morning ?? [item(`M${i}`)],
      afternoon: d.afternoon ?? [item(`A${i}`)],
      evening: d.evening ?? [item(`E${i}`, { type: 'restaurant' })],
      notes: '',
      estimatedCost: '$$',
      theme: d.theme,
    })),
  };
}

function research(
  located: Array<{ name: string; lat: number; lng: number }> = [],
  extraNames: string[] = []
): ResearchResult {
  return {
    destination: 'Testville',
    attractions: [
      ...located.map((l) => ({
        name: l.name,
        description: '',
        category: 'x',
        estimatedDuration: 90,
        priceRange: '$$',
        coordinates: { lat: l.lat, lng: l.lng },
      })),
      ...extraNames.map((n) => ({
        name: n,
        description: '',
        category: 'x',
        estimatedDuration: 90,
        priceRange: '$$',
      })),
    ],
    restaurants: [],
    activities: [],
    localInsights: [],
    sources: [],
  };
}

describe('auditPlan — duplicates', () => {
  it('catches the same venue on two days despite a leading article', () => {
    const audit = auditPlan(
      plan([
        { afternoon: [item('The Bluebird Cafe')] },
        { afternoon: [item('Bluebird Cafe', { type: 'restaurant' })] },
      ]),
      research()
    );

    const dup = audit.findings.find((f) => f.issue.includes('already on day'));
    expect(dup).toBeDefined();
    expect(dup!.severity).toBe('high');
    expect(audit.scoreCeiling).toBeLessThanOrEqual(70);
  });

  it('does not flag the same name repeated within a single day', () => {
    // Within-day repeats are the planner's dedupe job, not a cross-day booking bug.
    const audit = auditPlan(
      plan([{ morning: [item('Cafe X')], afternoon: [item('Cafe X')] }]),
      research()
    );
    expect(audit.findings.some((f) => f.issue.includes('already on day'))).toBe(false);
  });
});

describe('auditPlan — geography', () => {
  // At lat 38.72 one degree of longitude is ~87km, so these sit ~14km and
  // ~28km from `near` — either side of the warn (12km) and fail (25km) lines.
  const near = { name: 'Near', lat: 38.72, lng: -9.13 };
  const mid = { name: 'Mid', lat: 38.72, lng: -8.97 };
  const far = { name: 'Far', lat: 38.72, lng: -8.81 };

  it('flags a day that crosses the city as high severity', () => {
    const audit = auditPlan(
      plan([{ morning: [item('Near')], afternoon: [item('Far')] }]),
      research([near, far])
    );
    const geo = audit.findings.find((f) => f.issue.includes('end to end'));
    expect(geo).toBeDefined();
    expect(geo!.severity).toBe('high');
    expect(audit.scoreCeiling).toBeLessThanOrEqual(65);
  });

  it('warns, without failing, on a merely stretched day', () => {
    const audit = auditPlan(
      plan([{ morning: [item('Near')], afternoon: [item('Mid')] }]),
      research([near, mid])
    );
    const geo = audit.findings.find((f) => f.severity === 'medium');
    expect(geo?.issue).toContain('more travel');
    expect(audit.scoreCeiling).toBe(80);
  });

  it('stays silent when the pool carries no coordinates', () => {
    // Reports on what it can see rather than inventing confidence.
    const audit = auditPlan(
      plan([{ morning: [item('Near')], afternoon: [item('Far')] }]),
      research([], ['Near', 'Far'])
    );
    expect(audit.findings.some((f) => f.issue.includes('end to end'))).toBe(false);
    expect(audit.stats.maxDaySpreadKm).toBe(0);
  });

  it('flags an item far outside the trip centre of mass', () => {
    // Buddha Eden is ~50km from Lisbon and shipped inside a 3-day Lisbon trip.
    const cluster = [
      { name: 'A', lat: 38.72, lng: -9.13 },
      { name: 'B', lat: 38.72, lng: -9.14 },
      { name: 'C', lat: 38.71, lng: -9.13 },
    ];
    const outlier = { name: 'Buddha Eden', lat: 39.2, lng: -9.15 };
    const audit = auditPlan(
      plan([
        { morning: [item('A')], afternoon: [item('B')], evening: [item('C', { type: 'restaurant' })] },
        { morning: [item('Buddha Eden')] },
      ]),
      research([...cluster, outlier])
    );
    const far = audit.findings.find((f) => f.issue.includes('separate day trip'));
    expect(far).toBeDefined();
    expect(far!.severity).toBe('high');
  });
});

describe('auditPlan — completeness and ordering', () => {
  it('flags an empty bucket', () => {
    const audit = auditPlan(plan([{ evening: [] }]), research());
    expect(audit.findings.some((f) => f.issue.includes('nothing scheduled'))).toBe(
      true
    );
  });

  it('flags an evening with no dinner', () => {
    const audit = auditPlan(
      plan([{ evening: [item('Rooftop view', { type: 'attraction' })] }]),
      research()
    );
    expect(audit.findings.some((f) => f.issue.includes('no dinner'))).toBe(true);
  });

  it('flags a day whose times run backwards', () => {
    const audit = auditPlan(
      plan([
        {
          morning: [item('First', { time: '11:00' })],
          afternoon: [item('Second', { time: '09:00' })],
        },
      ]),
      research()
    );
    expect(audit.findings.some((f) => f.issue.includes('runs backwards'))).toBe(true);
  });
});

describe('auditPlan — opening hours heuristic', () => {
  it('flags a bar scheduled in the morning', () => {
    // A live Tokyo run opened day 2 with "Bar Trench" at 09:00.
    const audit = auditPlan(
      plan([{ morning: [item('Bar Trench', { time: '09:00' })] }]),
      research()
    );
    const shut = audit.findings.find((f) => f.issue.includes('almost certainly shut'));
    expect(shut).toBeDefined();
    expect(audit.scoreCeiling).toBeLessThanOrEqual(85);
  });

  it('leaves the same venue alone in the evening', () => {
    const audit = auditPlan(
      plan([{ evening: [item('Bar Trench', { time: '20:00', type: 'restaurant' })] }]),
      research()
    );
    expect(audit.findings.some((f) => f.issue.includes('almost certainly shut'))).toBe(
      false
    );
  });

  it('does not trip on words that merely contain a marker', () => {
    const audit = auditPlan(
      plan([
        {
          morning: [
            item('Barcelona Cathedral', { time: '09:00' }),
            item('Barbara Hepworth Museum', { time: '10:00' }),
          ],
        },
      ]),
      research()
    );
    expect(audit.findings.some((f) => f.issue.includes('almost certainly shut'))).toBe(
      false
    );
  });
});

describe('auditPlan — provenance', () => {
  it('flags a plan mostly made of places the research never found', () => {
    const audit = auditPlan(
      plan([
        {
          morning: [item('Invented One')],
          afternoon: [item('Invented Two')],
          evening: [item('Invented Three', { type: 'restaurant' })],
        },
      ]),
      research([], ['Something Real'])
    );
    const offPool = audit.findings.find((f) => f.issue.includes('not from the research pool'));
    expect(offPool).toBeDefined();
    expect(audit.stats.offPoolItems).toBe(3);
  });

  it('does not flag provenance when the pool is empty (nothing to compare against)', () => {
    const audit = auditPlan(plan([{}]), research());
    expect(
      audit.findings.some((f) => f.issue.includes('not from the research pool'))
    ).toBe(false);
  });
});

describe('auditPlan — ceiling', () => {
  it('leaves a clean plan uncapped', () => {
    const audit = auditPlan(plan([{}]), research([], ['M0', 'A0', 'E0']));
    expect(audit.findings).toEqual([]);
    expect(audit.scoreCeiling).toBe(100);
    expect(audit.summary).toContain('no duplicates');
  });

  it('takes the strictest ceiling when several findings stack', () => {
    const audit = auditPlan(
      plan([
        { afternoon: [item('The Bluebird Cafe')] },
        { afternoon: [item('Bluebird Cafe')], evening: [] },
      ]),
      research()
    );
    // Duplicate caps at 70, empty bucket at 80 → strictest wins.
    expect(audit.scoreCeiling).toBe(70);
  });
});
