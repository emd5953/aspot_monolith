import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { insertActivityRow } from './itinerary-generator';

/**
 * Regression guard for the audit find: when activities.source (migration 013)
 * isn't applied, an insert that includes `source` fails the whole row — and the
 * caller only logs — so itineraries would silently save with zero activities.
 * insertActivityRow must retry without provenance so the activity still lands.
 */

/** Minimal supabase stub whose insert returns a queued sequence of results. */
function stubSupabase(results: Array<{ error: unknown }>) {
  const insert = vi.fn<(row: Record<string, unknown>) => Promise<{ error: unknown }>>(() =>
    Promise.resolve(results.shift()!)
  );
  const from = vi.fn(() => ({ insert }));
  return { client: { from } as unknown as SupabaseClient, insert, from };
}

const row = { day_id: 'd1', title: 'Museum', sort_order: 1, source: 'reddit' };

describe('insertActivityRow', () => {
  it('inserts once and succeeds when the schema is current', async () => {
    const { client, insert } = stubSupabase([{ error: null }]);
    const ok = await insertActivityRow(client, { ...row });
    expect(ok).toBe(true);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toHaveProperty('source', 'reddit');
  });

  it('retries without source when the first insert errors, and keeps the activity', async () => {
    const { client, insert } = stubSupabase([
      { error: { message: "Could not find the 'source' column" } },
      { error: null },
    ]);
    const ok = await insertActivityRow(client, { ...row });
    expect(ok).toBe(true);
    expect(insert).toHaveBeenCalledTimes(2);
    // Second attempt must drop the provenance field, keep everything else.
    expect(insert.mock.calls[1][0]).not.toHaveProperty('source');
    expect(insert.mock.calls[1][0]).toHaveProperty('title', 'Museum');
  });

  it('does not retry when there was no source field to blame', async () => {
    const noSource = { day_id: 'd1', title: 'Museum', sort_order: 1 };
    const { client, insert } = stubSupabase([{ error: { message: 'some other failure' } }]);
    const ok = await insertActivityRow(client, { ...noSource });
    expect(ok).toBe(false);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('reports failure when even the retry fails', async () => {
    const { client, insert } = stubSupabase([
      { error: { message: 'no source column' } },
      { error: { message: 'still broken' } },
    ]);
    const ok = await insertActivityRow(client, { ...row });
    expect(ok).toBe(false);
    expect(insert).toHaveBeenCalledTimes(2);
  });
});
