import { EventSource, RawCandidate } from './types';

/**
 * TikTok connector — STUB.
 *
 * TikTok has no self-serve official route (Research API is academic-only;
 * Display API is own-account only), so this source will run through a
 * commercial scraper API (Apify / EnsembleData / ScrapeCreators — vendor
 * bake-off pending). Pipeline shape when implemented:
 *   curated NYC creator+hashtag list → daily pull → captions →
 *   LLM extraction of venue/event/date → Google Places verification.
 * Provenance rule: a TikTok candidate that cannot be resolved to a real
 * place/event gets dropped, never guessed.
 *
 * Disabled by default until a vendor is wired in (SOURCE_TIKTOK_ENABLED=true).
 */
export const tiktokSource: EventSource = {
  name: 'tiktok',
  enabled(): boolean {
    return process.env.SOURCE_TIKTOK_ENABLED === 'true';
  },
  async fetchCandidates(): Promise<RawCandidate[]> {
    console.warn('[sources/tiktok] stub — vendor integration pending, returning no candidates');
    return [];
  },
};
