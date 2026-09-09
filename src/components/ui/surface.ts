/**
 * Two surface modes, decided by route.
 *
 * - `cinematic` — the video background stays: `/` and `/dashboard`. These are
 *   arrival screens whose only content is one input, so the footage doesn't
 *   compete with anything.
 * - `paper` — flat, quiet, dark-on-light: every other screen. These carry real
 *   content density, where video forces text shadows and frosted pills just to
 *   stay legible. That compensation was the actual noise, not the video.
 *
 * Single source of truth so no page has to be handed a `tone` prop.
 */
export type Surface = 'cinematic' | 'paper';

const CINEMATIC_ROUTES = ['/dashboard'];

export function surfaceFor(pathname: string): Surface {
  if (pathname === '/') return 'cinematic';
  return CINEMATIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
    ? 'cinematic'
    : 'paper';
}
