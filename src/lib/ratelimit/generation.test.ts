import { describe, it, expect } from 'vitest';
import { checkRateLimit, GENERATION_RATE_LIMIT } from './generation';

const NOW = 1_000_000_000_000; // fixed "now" in ms
const HOUR = 60 * 60 * 1000;
const opts = { max: 3, windowMs: HOUR };

describe('checkRateLimit', () => {
  it('allows when under the cap and reports remaining', () => {
    const d = checkRateLimit([NOW - 1000, NOW - 2000], NOW, opts);
    expect(d.allowed).toBe(true);
    expect(d.remaining).toBe(0); // max 3, 2 used + this one = 3
    expect(d.retryAfterSeconds).toBe(0);
  });

  it('allows the very first generation', () => {
    const d = checkRateLimit([], NOW, opts);
    expect(d.allowed).toBe(true);
    expect(d.remaining).toBe(2);
  });

  it('blocks at the cap with a sane retry-after', () => {
    const oldest = NOW - 10 * 60 * 1000; // 10 min ago
    const d = checkRateLimit([oldest, NOW - 5 * 60 * 1000, NOW - 60 * 1000], NOW, opts);
    expect(d.allowed).toBe(false);
    expect(d.remaining).toBe(0);
    // oldest ages out 50 minutes from now → ~3000s
    expect(d.retryAfterSeconds).toBe(Math.ceil((oldest + HOUR - NOW) / 1000));
    expect(d.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('ignores timestamps outside the window', () => {
    const old = [NOW - 2 * HOUR, NOW - 90 * 60 * 1000]; // both older than 1h
    const d = checkRateLimit([...old, NOW - 1000], NOW, opts);
    expect(d.allowed).toBe(true);
    expect(d.remaining).toBe(1); // only 1 counts in-window
  });

  it('defaults to 10/hour', () => {
    expect(GENERATION_RATE_LIMIT).toEqual({ max: 10, windowMs: HOUR });
    const elevenAgo = Array.from({ length: 10 }, (_, i) => NOW - (i + 1) * 1000);
    expect(checkRateLimit(elevenAgo, NOW).allowed).toBe(false);
    expect(checkRateLimit(elevenAgo.slice(0, 9), NOW).allowed).toBe(true);
  });
});
