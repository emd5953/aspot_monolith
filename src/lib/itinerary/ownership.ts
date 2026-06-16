/**
 * Shared ownership guard for itinerary routes.
 *
 * Most itinerary-mutating routes (move, add, status, day-regenerate) already
 * do this check inline: fetch the itinerary, then 403 unless the caller owns
 * it. A few routes (revert, regenerate, versions) were missing it and relied
 * solely on Postgres RLS — which blocks total strangers but still lets a *trip
 * member* trigger owner-only operations (a paid regenerate, a destructive
 * revert) on someone else's itinerary. This centralises the decision so every
 * route enforces the same owner-only rule, and so it's unit-testable.
 *
 * Owner-only by design: trip members may *view* an itinerary but not mutate it
 * through these routes (matching the existing sibling routes).
 */

export type OwnerGuardResult =
  | { ok: true }
  | { ok: false; status: 403 | 404; error: string };

export function ownerGuard(
  itinerary: { userId: string } | null | undefined,
  userId: string
): OwnerGuardResult {
  if (!itinerary) return { ok: false, status: 404, error: 'Itinerary not found' };
  if (itinerary.userId !== userId) return { ok: false, status: 403, error: 'Forbidden' };
  return { ok: true };
}
