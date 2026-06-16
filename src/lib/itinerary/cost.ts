/**
 * Itinerary cost rollups + budget-fit classification.
 *
 * Pure helpers: sum estimated activity costs per day and for the trip, format
 * as currency, and judge the total against the traveler's budget tier. No I/O,
 * so the math is unit-testable and the view/email stay thin.
 *
 * `estimatedCost` may arrive as a number OR a PostgREST DECIMAL string, so all
 * reads coerce defensively and ignore anything non-finite or <= 0.
 */

export type BudgetStatus = 'under' | 'within' | 'over';

/** Rough per-day activity+food ceiling (USD) by canonical budget tier. */
const PER_DAY_CEILING_USD: Record<string, number> = {
  budget: 120,
  moderate: 300,
  luxury: 800,
};

export interface ActivityCostLike {
  estimatedCost?: number | string | null;
}

export interface DayCostLike {
  activities: ActivityCostLike[];
}

export interface CostRollup {
  /** Per-day subtotals, index-aligned with the input days. */
  perDay: number[];
  total: number;
  /** False when no activity carried a usable cost — show "no estimates". */
  hasData: boolean;
}

function coerceCost(value: number | string | null | undefined): number {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
}

export function sumDayCost(activities: ActivityCostLike[]): number {
  return activities.reduce((sum, a) => sum + coerceCost(a.estimatedCost), 0);
}

export function rollUpCost(days: DayCostLike[]): CostRollup {
  const perDay = days.map((d) => sumDayCost(d.activities));
  const total = perDay.reduce((sum, v) => sum + v, 0);
  const hasData = days.some((d) => d.activities.some((a) => coerceCost(a.estimatedCost) > 0));
  return { perDay, total, hasData };
}

/** "$1,250" — whole dollars, thousands-separated. */
export function formatUsd(amount: number): string {
  return '$' + Math.round(amount).toLocaleString('en-US');
}

export function tripBudgetCeiling(budgetRange: string | undefined, numDays: number): number {
  const perDay = PER_DAY_CEILING_USD[(budgetRange ?? '').toLowerCase()] ?? PER_DAY_CEILING_USD.moderate;
  return perDay * Math.max(1, numDays);
}

/**
 * Classify the trip total against the budget tier's ceiling:
 *  - over   : total exceeds the ceiling
 *  - under  : comfortably below (< half the ceiling)
 *  - within : in between
 */
export function classifyBudget(
  total: number,
  budgetRange: string | undefined,
  numDays: number
): { ceiling: number; status: BudgetStatus } {
  const ceiling = tripBudgetCeiling(budgetRange, numDays);
  let status: BudgetStatus;
  if (total > ceiling) status = 'over';
  else if (total < ceiling * 0.5) status = 'under';
  else status = 'within';
  return { ceiling, status };
}

export const BUDGET_STATUS_LABEL: Record<BudgetStatus, string> = {
  under: 'Well under budget',
  within: 'On budget',
  over: 'Over budget',
};
