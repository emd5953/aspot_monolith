/**
 * Weekend alignment for parsed trip dates.
 *
 * The prompt parser resolves a length and a start date, but when the user says
 * "a weekend in X" with no explicit date it can land the trip on a weekday
 * (e.g. a 3-day "weekend" starting Wednesday). A weekend trip should obviously
 * begin on the weekend: Saturday for a plain "weekend", Friday for a "long
 * weekend". This shifts the whole date window forward to the next such day,
 * preserving the trip length. Deterministic and pure — no LLM, no paid call.
 *
 * It only shifts forward (never backward) so it never lands a trip in the past,
 * and it keeps the window inside whatever timeframe the model chose: a Wednesday
 * in June snaps to that same week's Fri/Sat, still in June.
 */

export type WeekendKind = 'long' | 'short';

/** Detect whether the prompt asks for a weekend trip, and which flavour. */
export function weekendKind(prompt: string): WeekendKind | null {
  if (/\blong\s+weekend\b/i.test(prompt)) return 'long';
  if (/\bweekend\b/i.test(prompt)) return 'short';
  return null;
}

/**
 * If the prompt is a weekend request, shift [startISO, endISO] forward so the
 * start falls on Friday (long weekend) or Saturday (plain weekend). Length is
 * preserved by moving the end by the same number of days. Non-weekend prompts
 * and unparseable dates pass through unchanged.
 */
export function alignToWeekend(
  startISO: string,
  endISO: string,
  prompt: string
): { startDate: string; endDate: string } {
  const kind = weekendKind(prompt);
  if (!kind) return { startDate: startISO, endDate: endISO };

  const start = parseLocalDate(startISO);
  const end = parseLocalDate(endISO);
  if (!start || !end) return { startDate: startISO, endDate: endISO };

  const targetDow = kind === 'long' ? 5 /* Friday */ : 6 /* Saturday */;
  const delta = (targetDow - start.getDay() + 7) % 7;
  if (delta === 0) return { startDate: startISO, endDate: endISO };

  return {
    startDate: formatLocalDate(addDaysLocal(start, delta)),
    endDate: formatLocalDate(addDaysLocal(end, delta)),
  };
}

// Parse YYYY-MM-DD as a *local* calendar date. (new Date("2026-07-08") is UTC
// midnight, which getDay() can read as the previous day — so build it locally.)
function parseLocalDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatLocalDate(d: Date): string {
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mo}-${da}`;
}

function addDaysLocal(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}
