/**
 * The server-side Google API key.
 *
 * Deliberately NOT `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. That key is inlined into
 * the browser bundle by the Maps JS loader, so it is readable by anyone with
 * devtools open — which is fine only as long as it is locked down in the Cloud
 * console to the Maps JavaScript API and our own referrers.
 *
 * Every call in this directory that hits a Google REST endpoint from the server
 * (Places, Geocoding, Distance Matrix) uses this key instead. Server calls send
 * no Referer header, so they cannot share a referrer-restricted key; giving them
 * their own key is what lets the public one stay narrow.
 *
 * Returns undefined when unset. Callers already treat a missing key as "skip" —
 * they degrade, they never throw at request time.
 */
export function googleServerKey(): string | undefined {
  return process.env.GOOGLE_MAPS_SERVER_KEY;
}
