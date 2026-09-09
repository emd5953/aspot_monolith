import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client — bypasses RLS. Server-only, never expose to the browser.
 *
 * Use it where the capability check lives in the route rather than in a
 * policy: the ingestion cron (candidate_events has no user insert policy) and
 * shared-link reads (knowing the unguessable share code IS the permission,
 * so RLS must not also grant every authenticated user blanket read access).
 *
 * Throws when the credentials are missing so a misconfigured deploy fails
 * loudly instead of silently falling back to a weaker client.
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Supabase service credentials missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  }
  return createClient(url, serviceKey);
}
