import { dedupeKey } from '../provenance';
import type { ItineraryPlan, PlanItem, ResearchResult } from './types';

/**
 * The mechanical quality floor for a flat plan list.
 *
 * This is what survives of `plan-audit.ts` after scheduling was removed. Most
 * of that file checked a *schedule*: backwards clocks, empty morning buckets,
 * missing lunches, per-day geographic sprawl, venues booked while shut. None
 * of those can occur when nothing is being scheduled — Spotz now selects real
 * events and orders them by the start time their source published.
 *
 * Two checks were not about scheduling, and both are load-bearing:
 *
 *  1. **The same venue twice.** The LLM reviewer once scored 92/100 for a plan
 *     that booked one venue twice. A model grading its own output does not
 *     reliably notice repetition; a Set does.
 *  2. **Invented places.** The planner can name a venue from model recall
 *     instead of picking from the researched pool. That is the one failure the
 *     product cannot ship — every Spotz plan is supposed to be a real place
 *     with provenance.
 *
 * Deliberately model-free, pure, and cheap, so it can run on every generation
 * rather than being an occasional audit.
 */

/** Above this share of unverifiable items, the plan is model recall, not research. */
const OFF_POOL_WARN_RATIO = 0.4;

export interface PlanCheckFinding {
  severity: 'low' | 'medium' | 'high';
  issue: string;
  suggestion: string;
  /** The highest score this plan may be given while this finding stands. */
  scoreCeiling: number;
}

export interface PlanCheck {
  findings: PlanCheckFinding[];
  /** Min over findings. A reviewer may not score above this. */
  scoreCeiling: number;
  summary: string;
  stats: {
    totalItems: number;
    duplicateItems: number;
    offPoolItems: number;
    /** How many picks carry a real published start time. */
    timedItems: number;
  };
}

/** Every name the research pass actually found, as dedupe keys. */
function buildPoolKeys(research: ResearchResult): Set<string> {
  const keys = new Set<string>();
  for (const item of [
    ...(research.attractions ?? []),
    ...(research.restaurants ?? []),
    ...(research.activities ?? []),
  ]) {
    const key = dedupeKey(item.name);
    if (key) keys.add(key);
  }
  return keys;
}

export function checkPlan(plan: ItineraryPlan, research: ResearchResult): PlanCheck {
  const findings: PlanCheckFinding[] = [];
  const items: PlanItem[] = plan.plans ?? [];
  const poolKeys = buildPoolKeys(research);

  // ── 1. The same venue twice ────────────────────────────────────────────────
  // Note this is a *within-list* check. The old day-based version only fired
  // when a venue repeated across two different days, which on a single flat
  // list would never fire at all.
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const item of items) {
    const key = dedupeKey(item.name);
    if (!key) continue;
    if (seen.has(key)) duplicates.push(item.name);
    else seen.add(key);
  }
  if (duplicates.length > 0) {
    findings.push({
      severity: 'high',
      issue: `The list books the same place more than once: ${duplicates
        .slice(0, 5)
        .map((n) => `"${n}"`)
        .join(', ')}.`,
      suggestion:
        'Drop the repeat and pull an unused option from the research pool in its place.',
      scoreCeiling: 70,
    });
  }

  // ── 2. Invented places ─────────────────────────────────────────────────────
  // Empty pool means research produced nothing, so nothing can be judged
  // off-pool — silence beats accusing every item of being invented.
  const offPool = poolKeys.size
    ? items.filter((i) => !poolKeys.has(dedupeKey(i.name)))
    : [];
  if (items.length > 0 && offPool.length / items.length > OFF_POOL_WARN_RATIO) {
    findings.push({
      severity: 'medium',
      issue: `${offPool.length} of ${items.length} plans are not from the research pool (${offPool
        .slice(0, 5)
        .map((i) => `"${i.name}"`)
        .join(', ')}) — these are model recall, not verified places.`,
      suggestion:
        'Replace the untraceable plans with candidates from the research pool, which are real and carry provenance.',
      scoreCeiling: 80,
    });
  }

  const scoreCeiling = findings.reduce((min, f) => Math.min(min, f.scoreCeiling), 100);

  return {
    findings,
    scoreCeiling,
    summary:
      findings.length === 0
        ? 'Automated checks found no duplicate or unverifiable places.'
        : findings.map((f) => `- [${f.severity}] ${f.issue}`).join('\n'),
    stats: {
      totalItems: items.length,
      duplicateItems: duplicates.length,
      offPoolItems: offPool.length,
      timedItems: items.filter((i) => Boolean(i.startsAt)).length,
    },
  };
}
