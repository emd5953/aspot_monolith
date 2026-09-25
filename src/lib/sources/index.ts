import { EventSource } from './types';
import { poshSource } from './posh';
import { lumaSource } from './luma';
import { partifulSource } from './partiful';
import { tiktokSource } from './tiktok';

/** Priority order is product truth: Partiful > Posh > Luma > TikTok. */
export const ALL_SOURCES: EventSource[] = [partifulSource, poshSource, lumaSource, tiktokSource];

export function enabledSources(): EventSource[] {
  return ALL_SOURCES.filter((s) => s.enabled());
}

export * from './types';
export * from './pool-service';
