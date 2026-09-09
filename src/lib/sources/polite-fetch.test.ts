import { afterEach, describe, expect, it, vi } from 'vitest';
import { politeFetchJson, politeFetchText } from './polite-fetch';

// Real timers with small delays: the rate limiter keeps module-level state
// (the serialization gate), which fake timers make fragile across tests.
describe('politeFetch', () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it('serializes overlapping callers instead of firing them together', async () => {
    // The old timestamp-only limiter let two concurrent callers read the same
    // lastFetchAt, compute the same wait, and fire simultaneously.
    const startedAt: number[] = [];
    global.fetch = vi.fn(async () => {
      startedAt.push(Date.now());
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;

    await Promise.all([
      politeFetchJson('https://example.test/a', { delayMs: 120 }),
      politeFetchJson('https://example.test/b', { delayMs: 120 }),
    ]);

    expect(startedAt).toHaveLength(2);
    expect(startedAt[1] - startedAt[0]).toBeGreaterThanOrEqual(100);
  });

  it('aborts when the response body stalls past the timeout', async () => {
    // The timer used to be cleared in a `finally` that ran before the body was
    // read, so a stalled body hung with no timeout at all.
    global.fetch = vi.fn(async (_url: unknown, init: unknown) => {
      const signal = (init as RequestInit).signal as AbortSignal;
      return new Response(
        new ReadableStream({
          start(controller) {
            signal.addEventListener('abort', () => controller.error(new Error('aborted')));
            // Never enqueues, never closes: a body that stalls forever.
          },
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    await expect(
      politeFetchText('https://example.test/stall', { delayMs: 0, timeoutMs: 80 })
    ).rejects.toThrow();
  }, 10_000);

  it('throws on a non-2xx response', async () => {
    global.fetch = vi.fn(
      async () => new Response('nope', { status: 403, statusText: 'Forbidden' })
    ) as unknown as typeof fetch;

    await expect(
      politeFetchJson('https://example.test/denied', { delayMs: 0 })
    ).rejects.toThrow('403');
  });

  it('keeps serving later callers after one fails', async () => {
    // A rejected turn must not wedge the shared gate.
    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 })) as unknown as typeof fetch;

    await expect(politeFetchJson('https://example.test/1', { delayMs: 0 })).rejects.toThrow();
    await expect(politeFetchJson('https://example.test/2', { delayMs: 0 })).resolves.toEqual({
      ok: true,
    });
  });
});
