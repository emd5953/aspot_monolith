import { Resend } from 'resend';

/**
 * Singleton Resend client. Reads RESEND_API_KEY from env.
 * Returns null if the key isn't configured (graceful degradation —
 * emails just won't send in dev if you haven't set it up yet).
 */
export function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[email] RESEND_API_KEY not set — emails disabled');
    return null;
  }
  return new Resend(key);
}
