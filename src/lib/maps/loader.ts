/**
 * Singleton loader for the Google Maps JavaScript API.
 *
 * The map component's effect re-runs (on prop changes and React's dev
 * double-invoke), and a naive `if (!window.google)` guard lets several runs
 * append their own <script> before any has finished — which both triggers
 * Google's "included multiple times" warning and lets code touch
 * `google.maps.*` before the namespace exists. This module caches a single
 * load promise and a single <script> (by id), so the API is fetched exactly
 * once and callers always await a fully-initialised namespace.
 */

const SCRIPT_ID = 'google-maps-js-api';

let mapsPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(apiKey: string): Promise<typeof google> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only load in the browser'));
  }
  if (window.google?.maps) {
    return Promise.resolve(window.google);
  }
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise<typeof google>((resolve, reject) => {
    const finish = () => {
      if (window.google?.maps) {
        resolve(window.google);
      } else {
        mapsPromise = null; // let a later call retry
        reject(new Error('Google Maps loaded but the maps namespace is unavailable'));
      }
    };
    const fail = () => {
      mapsPromise = null; // failures shouldn't poison future attempts
      reject(new Error('Failed to load Google Maps'));
    };

    // Reuse a script another mount/component already added, rather than adding a second.
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', finish, { once: true });
      existing.addEventListener('error', fail, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    // No `libraries` param: nothing here touches google.maps.places or
    // google.maps.geometry. Leaving `places` off matters beyond dead weight —
    // it keeps Places off the browser key's allowed APIs entirely, so the key
    // sitting in the bundle can only do Maps JS, Geocoding, and Directions.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', fail, { once: true });
    document.head.appendChild(script);
  });

  return mapsPromise;
}
