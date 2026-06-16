/**
 * Geographic helpers for itinerary days.
 *
 * Pure great-circle math (no paid API): how far a day's stops are spread apart,
 * so the view can gently flag a day that zig-zags across a city. Only activities
 * that carry real coordinates participate; everything degrades to "no signal".
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two points, in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface ProximityPoint {
  coordinates?: LatLng | null;
}

function locatedCoords(points: ProximityPoint[]): LatLng[] {
  return points
    .map((p) => p.coordinates)
    .filter(
      (c): c is LatLng =>
        !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng)
    );
}

/** Sum of consecutive-hop distances (km) across the located points in order. */
export function dayHopDistanceKm(points: ProximityPoint[]): number {
  const coords = locatedCoords(points);
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineKm(coords[i - 1], coords[i]);
  }
  return total;
}

/** Default "this day covers a lot of ground" threshold (km of back-and-forth). */
export const SPREAD_OUT_THRESHOLD_KM = 15;

/**
 * A day is "spread out" when its located stops total more than `thresholdKm` of
 * consecutive travel. Needs at least two located stops — otherwise there's no
 * signal and we say no.
 */
export function isDaySpreadOut(
  points: ProximityPoint[],
  thresholdKm: number = SPREAD_OUT_THRESHOLD_KM
): boolean {
  if (locatedCoords(points).length < 2) return false;
  return dayHopDistanceKm(points) > thresholdKm;
}

export interface OrderablePoint {
  id: string;
  coordinates?: { lat: number; lng: number } | null;
}

function isLocated(p: OrderablePoint): boolean {
  return !!p.coordinates && Number.isFinite(p.coordinates.lat) && Number.isFinite(p.coordinates.lng);
}

/**
 * Greedy nearest-neighbor ordering of a day's stops to cut down on travel.
 * Anchors on the first located stop, then repeatedly appends the closest
 * un-visited located stop. Stops without coordinates keep their original
 * relative order and are appended at the end. Returns the reordered ids.
 *
 * Greedy (not optimal TSP), but it reliably untangles a zig-zag day and is
 * cheap + deterministic.
 */
export function nearestNeighborOrder(points: OrderablePoint[]): string[] {
  const located = points.filter(isLocated);
  const unlocated = points.filter((p) => !isLocated(p));
  if (located.length <= 2) return points.map((p) => p.id);

  const remaining = [...located];
  const ordered: OrderablePoint[] = [remaining.shift()!];
  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1].coordinates!;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(last, remaining[i].coordinates!);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    ordered.push(remaining.splice(bestIdx, 1)[0]);
  }
  return [...ordered, ...unlocated].map((p) => p.id);
}
