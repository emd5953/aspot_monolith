'use client';

import { useState, useEffect } from 'react';
import { Search, MapPin, UtensilsCrossed, CalendarDays, Sparkles } from 'lucide-react';

/**
 * Steps shown to the user while their itinerary is being built.
 * Each step has an icon, a verb-y label, and an estimated cumulative time.
 * The component cycles through them on a timer (since we don't yet stream
 * real progress from the agent pipeline).
 */
const STEPS = [
  { icon: Search, label: 'Researching your destination', accent: 'text-sky-600' },
  { icon: MapPin, label: 'Mapping neighborhoods and routes', accent: 'text-violet-600' },
  { icon: UtensilsCrossed, label: 'Picking restaurants for your taste', accent: 'text-rose-600' },
  { icon: CalendarDays, label: 'Pacing each day to your rhythm', accent: 'text-emerald-600' },
  { icon: Sparkles, label: 'Adding the personal touches', accent: 'text-amber-600' },
];

const STEP_INTERVAL_MS = 4500;
// Total expected duration (cosmetic, drives the progress bar). Real generation
// can finish faster or slower; this is just a friendly visual proxy.
const ESTIMATED_TOTAL_MS = 22_000;

interface KanyeQuotesProps {
  destination?: string;
  realProgress?: { status: string; message: string; progress?: number } | null;
}

export function KanyeQuotes({ destination, realProgress }: KanyeQuotesProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // Cycle through the step labels.
  useEffect(() => {
    if (realProgress) return;
    const id = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % STEPS.length);
    }, STEP_INTERVAL_MS);
    return () => clearInterval(id);
  }, [realProgress]);

  // Drive the progress bar with an easing curve — it climbs fast at first,
  // then slows down as it approaches the end. Caps at 92% so it doesn't sit
  // at "done" for ages.
  useEffect(() => {
    if (realProgress?.progress !== undefined) {
      setProgress(realProgress.progress);
      return;
    }
    const startedAt = Date.now();
    const id = setInterval(() => {
      const ms = Date.now() - startedAt;
      setElapsed(ms);
      // Asymptotic curve: ratio = 1 - 1/(1 + ms/total). At ms == total, ratio = 0.5.
      // Then we map it through a softer cap.
      const r = ms / ESTIMATED_TOTAL_MS;
      const next = Math.min(92, Math.round(100 * (1 - 1 / (1 + r * 1.4))));
      setProgress(next);
    }, 250);
    return () => clearInterval(id);
  }, [realProgress]);

  const currentLabel =
    realProgress?.message ?? STEPS[currentStep]?.label ?? 'Working on it';
  const StepIcon = STEPS[currentStep]?.icon ?? Sparkles;
  const accent = STEPS[currentStep]?.accent ?? 'text-[color:var(--accent)]';

  // Long-trip reassurance copy.
  const longHint =
    elapsed > 60_000
      ? 'Hang tight — bigger trips take a moment longer.'
      : elapsed > 30_000
        ? 'Almost there.'
        : null;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-white shadow-[0_32px_80px_-20px_rgba(10,25,55,0.5)]">
      {/* Top progress bar */}
      <div className="h-1 w-full bg-[color:var(--surface-soft)]">
        <div
          className="h-full bg-[color:var(--ink)] transition-[width] duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="px-7 py-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-soft)]">
          {destination ? `Building ${destination}` : 'Building your trip'}
        </p>

        {/* Currently doing */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--surface-soft)]">
            <StepIcon className={`h-5 w-5 ${accent}`} strokeWidth={2} />
          </div>
          <h3 className="font-heading text-2xl leading-tight text-[color:var(--ink)]">
            {currentLabel}
          </h3>
        </div>

        {/* Step rail — small dots showing where we are in the sequence */}
        {!realProgress && (
          <div className="mt-6 flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
                  i <= currentStep
                    ? 'bg-[color:var(--ink)]'
                    : 'bg-[color:var(--surface-soft)]'
                }`}
              />
            ))}
          </div>
        )}

        {/* Reassurance line if it's been a while */}
        {longHint && (
          <p className="animate-fade-up mt-6 text-center text-sm text-[color:var(--ink-muted)]">
            {longHint}
          </p>
        )}

        {/* Soft footer */}
        <p className="mt-7 text-center text-xs text-[color:var(--ink-soft)]">
          You can leave this open. It usually takes 10–30 seconds.
        </p>
      </div>
    </div>
  );
}
