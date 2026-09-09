/**
 * Shared polite-fetch helper for source connectors.
 * Sequential by design: connectors call this in a loop, never in parallel.
 */

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const DEFAULT_DELAY_MS = 1500;

// `lastFetchAt` alone was read-then-written non-atomically: two overlapping
// callers both read the same value, computed the same wait, and fired
// simultaneously — defeating the rate limit exactly when politeness matters
// most. The gate serializes that read-modify-write without changing the
// timing: still a minimum gap between request *starts*, and no delay on the
// first call.
let lastFetchAt = 0;
let gate: Promise<void> = Promise.resolve();

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface PoliteFetchOptions {
  /** Minimum gap since the previous politeFetch call (default 1500ms). */
  delayMs?: number;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

/**
 * Fetch with a browser UA, a minimum inter-request delay (shared across all
 * connectors in this process), and a timeout. Throws on non-2xx.
 */
export async function politeFetch(url: string, opts: PoliteFetchOptions = {}): Promise<Response> {
  const delay = opts.delayMs ?? DEFAULT_DELAY_MS;

  // Take our turn in the queue before doing anything else.
  const ourTurn = gate.then(async () => {
    const wait = lastFetchAt + delay - Date.now();
    if (wait > 0) await sleep(wait);
    lastFetchAt = Date.now();
  });
  // A rejected turn must not wedge the queue for every later caller.
  gate = ourTurn.catch(() => {});
  await ourTurn;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, ...opts.headers },
      signal: controller.signal,
    });
    if (!res.ok) {
      clearTimeout(timer);
      throw new Error(`politeFetch ${url} -> ${res.status} ${res.statusText}`);
    }
    // Deliberately NOT cleared here: the body has not been read yet. Clearing
    // in a `finally` let a stalled response body hang forever with no timeout.
    // Ownership passes to the body readers below, which clear it once the
    // payload is in hand.
    return attachTimer(res, timer);
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/** Timers owned by a Response, cleared once its body has been read. */
const timers = new WeakMap<Response, ReturnType<typeof setTimeout>>();

function attachTimer(res: Response, timer: ReturnType<typeof setTimeout>): Response {
  timers.set(res, timer);
  return res;
}

function releaseTimer(res: Response): void {
  const timer = timers.get(res);
  if (timer !== undefined) {
    clearTimeout(timer);
    timers.delete(res);
  }
}

export async function politeFetchJson<T = unknown>(
  url: string,
  opts: PoliteFetchOptions = {}
): Promise<T> {
  const res = await politeFetch(url, {
    ...opts,
    headers: { Accept: 'application/json', ...opts.headers },
  });
  try {
    return (await res.json()) as T;
  } finally {
    releaseTimer(res);
  }
}

export async function politeFetchText(url: string, opts: PoliteFetchOptions = {}): Promise<string> {
  const res = await politeFetch(url, opts);
  try {
    return await res.text();
  } finally {
    releaseTimer(res);
  }
}
