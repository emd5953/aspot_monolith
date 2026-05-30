import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { ResearchResult } from './agents/types';

/**
 * File-based research cache. Stores the expensive web-research output by
 * destination + user-intent so subsequent generations for the same city +
 * same theme skip scraping entirely.
 *
 * Cache key: lowercase destination + 8-char hash of normalized userIntent
 *   (e.g. "new-york-city" + "__a1b2c3d4" for "R&B bars").
 *   Empty intent → just the destination key (preserves old generic cache).
 * Storage: `.cache/research/<key>.json` in the project root.
 * TTL: 7 days (travel data doesn't change that fast).
 *
 * This is a dev/production optimization — not a mock. The cached data is
 * real research output from a previous run.
 */

const CACHE_DIR = join(process.cwd(), '.cache', 'research');
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry {
  destination: string;
  result: ResearchResult;
  thoughts: string[];
  cachedAt: string; // ISO timestamp
}

function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Normalize the intent string before hashing so trivial variations
 * ("R&B Bars" vs "r&b bars") share the same cache slot.
 */
function normalizeIntent(intent?: string): string {
  if (!intent) return '';
  return intent.toLowerCase().trim().replace(/\s+/g, ' ');
}

function cacheKeyToFile(destination: string, userIntent?: string): string {
  const destKey = destination.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
  const normIntent = normalizeIntent(userIntent);
  if (!normIntent) {
    return join(CACHE_DIR, `${destKey}.json`);
  }
  const intentHash = createHash('sha1').update(normIntent).digest('hex').slice(0, 8);
  return join(CACHE_DIR, `${destKey}__${intentHash}.json`);
}

/**
 * Look up cached research for a destination + intent. Returns null if not
 * cached or if the cache entry is older than TTL.
 */
export function getCachedResearch(
  destination: string,
  userIntent?: string
): { result: ResearchResult; thoughts: string[] } | null {
  const file = cacheKeyToFile(destination, userIntent);
  if (!existsSync(file)) return null;

  try {
    const raw = readFileSync(file, 'utf-8');
    const entry: CacheEntry = JSON.parse(raw);

    // Check TTL
    const age = Date.now() - new Date(entry.cachedAt).getTime();
    if (age > TTL_MS) {
      console.log(`[research-cache] Cache expired for "${destination}" (${Math.round(age / 1000 / 60 / 60)}h old)`);
      return null;
    }

    console.log(`[research-cache] ✓ Cache hit for "${destination}"${userIntent ? ` (intent: "${userIntent}")` : ''} (${Math.round(age / 1000 / 60)}min old)`);
    return { result: entry.result, thoughts: entry.thoughts };
  } catch (err) {
    console.warn(`[research-cache] Failed to read cache for "${destination}":`, err);
    return null;
  }
}

/**
 * Store research output in the file cache.
 */
export function setCachedResearch(
  destination: string,
  result: ResearchResult,
  thoughts: string[],
  userIntent?: string
): void {
  ensureCacheDir();
  const file = cacheKeyToFile(destination, userIntent);

  const entry: CacheEntry = {
    destination: destination.trim(),
    result,
    thoughts,
    cachedAt: new Date().toISOString(),
  };

  try {
    writeFileSync(file, JSON.stringify(entry, null, 2), 'utf-8');
    console.log(`[research-cache] ✓ Cached research for "${destination}"${userIntent ? ` (intent: "${userIntent}")` : ''}`);
  } catch (err) {
    console.warn(`[research-cache] Failed to write cache for "${destination}":`, err);
  }
}

/**
 * Clear all cached research (useful for dev).
 */
export function clearResearchCache(): void {
  const { readdirSync, unlinkSync } = require('fs');
  if (!existsSync(CACHE_DIR)) return;
  const files = readdirSync(CACHE_DIR) as string[];
  for (const f of files) {
    if (f.endsWith('.json')) {
      unlinkSync(join(CACHE_DIR, f));
    }
  }
  console.log(`[research-cache] Cleared ${files.length} entries`);
}
