import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { swapDayActivities } from './itinerary-service';

/**
 * Regression guard for the audit find: regenerateDay used to DELETE a day's
 * activities then INSERT replacements, so a failed insert wiped the day.
 * swapDayActivities must insert FIRST and only delete the originals on success.
 */

/**
 * Chainable supabase stub. Records the order of insert/delete and lets each
 * test decide whether the insert succeeds. `select('id')` returns the existing
 * old rows; `insert().select()` returns inserted rows or an error.
 */
function stubSupabase(opts: {
  existingIds: string[];
  insertError?: { message: string } | null;
  insertedRows?: Array<Record<string, unknown>>;
}) {
  const order: string[] = [];
  const deletedIds: string[][] = [];

  const client = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        // .select('id').eq('day_id', …)
        eq: vi.fn(() =>
          Promise.resolve({ data: opts.existingIds.map((id) => ({ id })), error: null })
        ),
      })),
      insert: vi.fn(() => ({
        // .insert(rows).select()
        select: vi.fn(() => {
          order.push('insert');
          return Promise.resolve({
            data: opts.insertError ? null : (opts.insertedRows ?? [{ id: 'new1' }]),
            error: opts.insertError ?? null,
          });
        }),
      })),
      delete: vi.fn(() => ({
        in: vi.fn((_col: string, ids: string[]) => {
          order.push('delete');
          deletedIds.push(ids);
          return Promise.resolve({ error: null });
        }),
      })),
    })),
  } as unknown as SupabaseClient;

  return { client, order, deletedIds };
}

const rows = [{ day_id: 'd1', title: 'New', sort_order: 1 }];

describe('swapDayActivities', () => {
  it('inserts before deleting, and deletes exactly the old ids', async () => {
    const { client, order, deletedIds } = stubSupabase({
      existingIds: ['old1', 'old2'],
      insertedRows: [{ id: 'new1', title: 'New' }],
    });

    const result = await swapDayActivities(client, 'd1', rows);

    expect(order).toEqual(['insert', 'delete']); // insert strictly before delete
    expect(deletedIds[0]).toEqual(['old1', 'old2']);
    expect(result).toEqual([{ id: 'new1', title: 'New' }]);
  });

  it('preserves the originals (never deletes) when the insert fails', async () => {
    const { client, order } = stubSupabase({
      existingIds: ['old1', 'old2'],
      insertError: { message: 'boom' },
    });

    await expect(swapDayActivities(client, 'd1', rows)).rejects.toThrow(/Failed to save activities/);
    expect(order).toEqual(['insert']); // delete never happened → old rows intact
  });

  it('skips the delete when the day had no prior activities', async () => {
    const { client, order } = stubSupabase({ existingIds: [], insertedRows: [{ id: 'new1' }] });
    await swapDayActivities(client, 'd1', rows);
    expect(order).toEqual(['insert']);
  });
});
