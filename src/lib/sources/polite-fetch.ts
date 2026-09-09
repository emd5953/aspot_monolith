/**
 * Shared polite-fetch helper for source connectors.
 * Sequential by design: connectors call this in a loop, never in parallel.
 */

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const DEFAULT_DELAY_MS = 1500;

let lastFetchAt = 0;

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
  const wait = lastFetchAt + delay - Date.now();
  if (wait > 0) await sleep(wait);
  lastFetchAt = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, ...opts.headers },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`politeFetch ${url} -> ${res.status} ${res.statusText}`);
    }
    return res;
  } finally {
    clearTimeout(timer);
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
  return (await res.json()) as T;
}

export async function politeFetchText(url: string, opts: PoliteFetchOptions = {}): Promise<string> {
  const res = await politeFetch(url, opts);
  return await res.text();
}
