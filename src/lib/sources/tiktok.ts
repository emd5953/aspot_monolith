import { EventSource } from './types';

/**
 * Not implemented. A scraper subscription is not permission to reuse content.
 * See docs/specs/data-sourcing.md: creator-authorized Display API or submitted
 * links + official embeds, with separate confirmation of event date/location.
 */
export const tiktokSource: EventSource = {
  name: 'tiktok',
  enabled: () => process.env.SOURCE_TIKTOK_ENABLED === 'true',
  async fetchCandidates() {
    if (!this.enabled()) return [];
    throw new Error(
      'TikTok discovery is not implemented; authorized access and event verification are required'
    );
  },
};
