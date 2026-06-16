/**
 * Rough per-activity cost estimate.
 *
 * Research candidates carry a free-form price marker ("$"/"$$"/"$$$", "free",
 * "budget"/"moderate"/"luxury", …) but no dollar figure, so generated
 * activities had no cost and the trip cost rollup had nothing to sum. This maps
 * (category, price tier) to a ballpark USD figure — deliberately approximate,
 * surfaced as "Est." in the UI. Pure + unit-tested.
 */

export type PriceTier = 0 | 1 | 2 | 3; // free, $, $$, $$$

/** Best-effort normalize a free-form price marker to a 0–3 tier. */
export function normalizePriceTier(priceRange: string | undefined): PriceTier {
  const p = (priceRange ?? '').trim().toLowerCase();
  if (!p) return 2; // unknown → assume moderate

  if (p === 'free' || p === 'no cost' || p === '0') return 0;

  const dollars = (p.match(/\$/g) || []).length;
  if (dollars > 0) return Math.min(3, dollars) as PriceTier;

  if (/(budget|cheap|low|inexpensive)/.test(p)) return 1;
  if (/(moderate|mid|medium|average|standard)/.test(p)) return 2;
  if (/(luxury|expensive|high|premium|upscale|fine)/.test(p)) return 3;
  return 2;
}

/** Ballpark USD per person by category, indexed [free, $, $$, $$$]. */
const COST_BY_CATEGORY: Record<string, [number, number, number, number]> = {
  restaurant: [0, 15, 35, 80],
  dining: [0, 15, 35, 80],
  attraction: [0, 12, 25, 55],
  museum: [0, 12, 25, 55],
  activity: [0, 25, 60, 150],
  tour: [0, 25, 60, 150],
  nightlife: [0, 20, 45, 100],
  shopping: [0, 20, 50, 120],
  transport: [0, 0, 0, 0],
  free_time: [0, 0, 0, 0],
};

const DEFAULT_ROW = COST_BY_CATEGORY.attraction;

/**
 * Estimate an activity's cost (USD) from its category and price marker.
 * Returns 0 for free/transport/free-time slots.
 */
export function estimateActivityCost(
  category: string | undefined,
  priceRange: string | undefined
): number {
  const tier = normalizePriceTier(priceRange);
  const row = COST_BY_CATEGORY[(category ?? '').toLowerCase()] ?? DEFAULT_ROW;
  return row[tier];
}
