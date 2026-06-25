import { describe, it, expect } from 'vitest';
import { weekendKind, alignToWeekend } from './weekend-align';

// Reference: 2026-07-08 is a Wednesday. 07-10 Fri, 07-11 Sat, 07-12 Sun.

describe('weekendKind', () => {
  it('detects a long weekend', () => {
    expect(weekendKind('a long weekend in Lisbon')).toBe('long');
  });
  it('detects a plain weekend', () => {
    expect(weekendKind('a weekend in Agartala')).toBe('short');
    expect(weekendKind('WEEKEND getaway')).toBe('short');
  });
  it('returns null when no weekend mentioned', () => {
    expect(weekendKind('4 days in Tokyo, food focused')).toBe(null);
  });
});

describe('alignToWeekend', () => {
  it('snaps a plain-weekend trip starting Wednesday forward to Saturday', () => {
    // The reported bug: "a weekend in..." began on Wednesday 07-08.
    const r = alignToWeekend('2026-07-08', '2026-07-10', 'a weekend in Agartala');
    expect(r.startDate).toBe('2026-07-11'); // Saturday
    expect(r.endDate).toBe('2026-07-13'); // length preserved (3 days)
  });

  it('snaps a long weekend forward to Friday', () => {
    const r = alignToWeekend('2026-07-08', '2026-07-10', 'long weekend in Lisbon');
    expect(r.startDate).toBe('2026-07-10'); // Friday
    expect(r.endDate).toBe('2026-07-12');
  });

  it('leaves an already-Saturday weekend untouched', () => {
    const r = alignToWeekend('2026-07-11', '2026-07-12', 'a weekend away');
    expect(r).toEqual({ startDate: '2026-07-11', endDate: '2026-07-12' });
  });

  it('leaves an already-Friday long weekend untouched', () => {
    const r = alignToWeekend('2026-07-10', '2026-07-12', 'long weekend trip');
    expect(r).toEqual({ startDate: '2026-07-10', endDate: '2026-07-12' });
  });

  it('does not touch non-weekend prompts', () => {
    const r = alignToWeekend('2026-07-08', '2026-07-11', '4 days in Tokyo');
    expect(r).toEqual({ startDate: '2026-07-08', endDate: '2026-07-11' });
  });

  it('only ever shifts forward (Sunday → next Saturday)', () => {
    // 2026-07-12 is a Sunday; a weekend should not start on Sunday.
    const r = alignToWeekend('2026-07-12', '2026-07-13', 'weekend');
    expect(r.startDate).toBe('2026-07-18'); // next Saturday
    expect(r.endDate).toBe('2026-07-19');
  });

  it('preserves a longer window length when shifting', () => {
    const r = alignToWeekend('2026-07-08', '2026-07-12', 'long weekend'); // Wed→Sun, 5 days
    expect(r.startDate).toBe('2026-07-10'); // Friday, +2
    expect(r.endDate).toBe('2026-07-14'); // +2, still 5 days
  });

  it('passes through unparseable dates', () => {
    const r = alignToWeekend('not-a-date', 'also-bad', 'a weekend');
    expect(r).toEqual({ startDate: 'not-a-date', endDate: 'also-bad' });
  });
});
