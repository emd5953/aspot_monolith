import { describe, it, expect } from 'vitest';
import { assignDayTimes, parseHhMm, formatHhMm } from './schedule-times';

describe('parseHhMm', () => {
  it('parses HH:MM and HH:MM:SS', () => {
    expect(parseHhMm('09:30')).toBe(570);
    expect(parseHhMm('18:05:45')).toBe(1085);
  });
  it('rejects junk and out-of-range', () => {
    expect(parseHhMm(undefined)).toBeNull();
    expect(parseHhMm('nope')).toBeNull();
    expect(parseHhMm('25:00')).toBeNull();
    expect(parseHhMm('10:75')).toBeNull();
  });
});

describe('formatHhMm', () => {
  it('formats and zero-pads, wrapping past midnight', () => {
    expect(formatHhMm(570)).toBe('09:30');
    expect(formatHhMm(0)).toBe('00:00');
    expect(formatHhMm(1440 + 90)).toBe('01:30'); // wraps
  });
});

describe('assignDayTimes', () => {
  it('honors planner times that respect order', () => {
    const t = assignDayTimes([
      { time: '09:00', durationMin: 60 },
      { time: '12:30', durationMin: 90 },
      { time: '19:00', durationMin: 120 },
    ]);
    expect(t).toEqual([
      { startTime: '09:00', endTime: '10:00' },
      { startTime: '12:30', endTime: '14:00' },
      { startTime: '19:00', endTime: '21:00' },
    ]);
  });

  it('lays out timeless items sequentially from 09:00 with travel gaps', () => {
    const t = assignDayTimes([{ durationMin: 60 }, { durationMin: 30 }]);
    // 09:00–10:00, then +20 gap → 10:20–10:50
    expect(t).toEqual([
      { startTime: '09:00', endTime: '10:00' },
      { startTime: '10:20', endTime: '10:50' },
    ]);
  });

  it('bumps a planner time that would overlap the previous activity', () => {
    const t = assignDayTimes([
      { time: '09:00', durationMin: 120 }, // ends 11:00, cursor → 11:20
      { time: '09:30', durationMin: 60 }, // earlier than cursor → bumped to 11:20
    ]);
    expect(t[1]).toEqual({ startTime: '11:20', endTime: '12:20' });
  });

  it('falls back to a default duration when missing or invalid', () => {
    const t = assignDayTimes([{ time: '09:00' }]); // no duration → 90 min default
    expect(t[0]).toEqual({ startTime: '09:00', endTime: '10:30' });
  });

  it('respects a custom day start', () => {
    const t = assignDayTimes([{ durationMin: 60 }], { dayStartMin: 8 * 60 });
    expect(t[0].startTime).toBe('08:00');
  });
});
