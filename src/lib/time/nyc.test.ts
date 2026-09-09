import { describe, it, expect } from 'vitest';
import { nycDate, nycTimeToUtc, calendarDateOf, nycNightWindow } from './nyc';

describe('nyc time helpers', () => {
  describe('nycTimeToUtc', () => {
    it('resolves EDT (summer) wall clock to the right UTC instant', () => {
      // 2026-07-15 is EDT (UTC-4), so midnight NYC is 04:00Z.
      expect(nycTimeToUtc('2026-07-15', 0).toISOString()).toBe('2026-07-15T04:00:00.000Z');
    });

    it('resolves EST (winter) wall clock to the right UTC instant', () => {
      // 2026-01-15 is EST (UTC-5), so midnight NYC is 05:00Z.
      expect(nycTimeToUtc('2026-01-15', 0).toISOString()).toBe('2026-01-15T05:00:00.000Z');
    });

    it('treats hour >= 24 as the following morning', () => {
      // 6am NYC on the 16th, expressed as hour 30 of the 15th.
      expect(nycTimeToUtc('2026-07-15', 30).toISOString()).toBe('2026-07-16T10:00:00.000Z');
    });

    it('lands correctly across the spring-forward boundary', () => {
      // DST starts 2026-03-08. A night that begins on the 7th (EST) ends 6am
      // on the 8th, which is already EDT — 10:00Z, not 11:00Z.
      expect(nycTimeToUtc('2026-03-07', 30).toISOString()).toBe('2026-03-08T10:00:00.000Z');
    });

    it('lands correctly across the fall-back boundary', () => {
      // DST ends 2026-11-01. Night begins the 31st (EDT), 6am on the 1st is EST.
      expect(nycTimeToUtc('2026-10-31', 30).toISOString()).toBe('2026-11-01T11:00:00.000Z');
    });
  });

  describe('nycDate', () => {
    it('reports the previous day for a UTC instant that is still evening in NYC', () => {
      // 02:00Z on the 10th is 22:00 on the 9th in NYC.
      expect(nycDate(new Date('2026-09-10T02:00:00Z'))).toBe('2026-09-09');
    });

    it('reports the same day once NYC has caught up', () => {
      expect(nycDate(new Date('2026-09-10T16:00:00Z'))).toBe('2026-09-10');
    });
  });

  describe('calendarDateOf', () => {
    it('recovers the date a bare YYYY-MM-DD string was parsed from', () => {
      // This is the trap: the NYC date of this instant is 2026-09-08.
      expect(calendarDateOf(new Date('2026-09-09'))).toBe('2026-09-09');
    });
  });

  describe('nycNightWindow', () => {
    it('spans local midnight to 6am the next morning', () => {
      const { from, to } = nycNightWindow('2026-09-09');
      expect(from.toISOString()).toBe('2026-09-09T04:00:00.000Z');
      expect(to.toISOString()).toBe('2026-09-10T10:00:00.000Z');
      expect(to.getTime() - from.getTime()).toBe(30 * 60 * 60 * 1000);
    });

    it('spans a multi-day window when given an end date', () => {
      const { from, to } = nycNightWindow('2026-09-09', '2026-09-11');
      expect(from.toISOString()).toBe('2026-09-09T04:00:00.000Z');
      expect(to.toISOString()).toBe('2026-09-12T10:00:00.000Z');
    });
  });
});
