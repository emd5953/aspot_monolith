import { describe, it, expect } from 'vitest';
import { orderByStartTime, dropDuplicatePlans } from './order-plans';
import type { PlanItem } from './types';

const plan = (name: string, startsAt?: string): PlanItem => ({
  name,
  type: 'activity',
  startsAt,
});

describe('orderByStartTime', () => {
  it('orders timed plans by when they actually start', () => {
    const out = orderByStartTime([
      plan('Late set', '2026-09-12T23:00:00-04:00'),
      plan('Dinner', '2026-09-12T19:30:00-04:00'),
      plan('Drinks', '2026-09-12T21:00:00-04:00'),
    ]);
    expect(out.map((p) => p.name)).toEqual(['Dinner', 'Drinks', 'Late set']);
  });

  it('sinks untimed plans below every timed one', () => {
    const out = orderByStartTime([
      plan('Some bar'),
      plan('Warehouse', '2026-09-12T23:00:00-04:00'),
      plan('A restaurant'),
      plan('Dinner', '2026-09-12T19:00:00-04:00'),
    ]);
    expect(out.map((p) => p.name)).toEqual([
      'Dinner',
      'Warehouse',
      'Some bar',
      'A restaurant',
    ]);
  });

  it('keeps rank order among untimed plans', () => {
    const out = orderByStartTime([plan('first'), plan('second'), plan('third')]);
    expect(out.map((p) => p.name)).toEqual(['first', 'second', 'third']);
  });

  it('keeps rank order when two events start at the same time', () => {
    const at = '2026-09-12T22:00:00-04:00';
    const out = orderByStartTime([plan('ranked first', at), plan('ranked second', at)]);
    expect(out.map((p) => p.name)).toEqual(['ranked first', 'ranked second']);
  });

  it('compares real instants, not strings, across offsets', () => {
    // 22:00 EDT is 02:00Z the next day — a string sort would get this backwards.
    const out = orderByStartTime([
      plan('EDT late', '2026-09-12T22:00:00-04:00'),
      plan('UTC earlier', '2026-09-13T01:00:00Z'),
    ]);
    expect(out.map((p) => p.name)).toEqual(['UTC earlier', 'EDT late']);
  });

  it('treats an unparseable time as unknown, not as the start of time', () => {
    const out = orderByStartTime([
      plan('garbage', 'not-a-date'),
      plan('real', '2026-09-12T20:00:00-04:00'),
    ]);
    // A NaN date must not sort to the top as epoch 0.
    expect(out.map((p) => p.name)).toEqual(['real', 'garbage']);
  });

  it('does not mutate its input', () => {
    const input = [
      plan('b', '2026-09-12T23:00:00-04:00'),
      plan('a', '2026-09-12T19:00:00-04:00'),
    ];
    orderByStartTime(input);
    expect(input.map((p) => p.name)).toEqual(['b', 'a']);
  });

  it('handles an empty list', () => {
    expect(orderByStartTime([])).toEqual([]);
  });
});

describe('dropDuplicatePlans', () => {
  it('keeps the first appearance of a repeated venue', () => {
    const out = dropDuplicatePlans([
      plan('House of Yes', '2026-09-12T22:00:00-04:00'),
      plan('Dinner'),
      plan('House of Yes', '2026-09-13T01:00:00-04:00'),
    ]);
    expect(out.map((p) => p.name)).toEqual(['House of Yes', 'Dinner']);
  });

  it('normalizes names before comparing', () => {
    // The exact failure this exists for: these are one venue, not two.
    const out = dropDuplicatePlans([plan('The Bluebird Cafe'), plan('Bluebird Cafe')]);
    expect(out).toHaveLength(1);
  });

  it('leaves a list with no repeats alone', () => {
    const out = dropDuplicatePlans([plan('a'), plan('b'), plan('c')]);
    expect(out.map((p) => p.name)).toEqual(['a', 'b', 'c']);
  });
});
