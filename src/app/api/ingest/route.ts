import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { enabledSources, upsertCandidates, expireCandidates } from '@/lib/sources';

export const maxDuration = 300;

/**
 * Scheduled ingestion: run every enabled source connector and refresh the
 * candidate_events pool. Triggered by Vercel cron (see vercel.json) or
 * manually with the same secret. NOT a user-facing route.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}` — Vercel cron sends this
 * automatically when CRON_SECRET is set in the environment.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Service-role client: candidate_events is written server-side only (RLS
  // has no insert policy for regular users).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase service credentials missing' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const results: Record<string, { fetched: number; written: number } | { error: string }> = {};

  // Sequential on purpose: politeness across sources, and Vercel functions
  // don't need the parallelism.
  for (const source of enabledSources()) {
    try {
      const candidates = await source.fetchCandidates();
      const written = await upsertCandidates(supabase, candidates);
      results[source.name] = { fetched: candidates.length, written };
    } catch (err) {
      console.error(`[ingest] source ${source.name} failed:`, err);
      results[source.name] = { error: err instanceof Error ? err.message : 'unknown' };
    }
  }

  let expired = 0;
  let expiryError: string | undefined;
  try {
    expired = await expireCandidates(supabase);
  } catch (err) {
    console.error('[ingest] expiry failed:', err);
    expiryError = err instanceof Error ? err.message : 'unknown';
  }

  // `ok` has to mean "the whole run succeeded". Reporting ok:true while a
  // source was failing is how a broken connector hides for weeks behind a
  // green cron: posh returned 403 from Vercel for two runs and the response
  // still said ok:true, because 0 candidates is indistinguishable from a
  // quiet night unless the failure is named.
  const failed = Object.entries(results)
    .filter(([, r]) => 'error' in r)
    .map(([name]) => name);
  const ok = failed.length === 0 && !expiryError;

  return NextResponse.json(
    {
      ok,
      ...(failed.length > 0 ? { failedSources: failed } : {}),
      results,
      expired,
      ...(expiryError ? { expiryError } : {}),
      at: new Date().toISOString(),
    },
    // 207 Multi-Status: some sources ran, some did not. Distinguishable from a
    // clean 200 by any uptime check watching the cron.
    { status: ok ? 200 : 207 }
  );
}
