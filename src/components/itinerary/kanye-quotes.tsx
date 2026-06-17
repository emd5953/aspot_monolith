'use client';

import { Loader2 } from 'lucide-react';

interface KanyeQuotesProps {
  destination?: string;
  realProgress?: { status: string; message: string; progress?: number } | null;
}

/**
 * Minimal, quiet loading indicator shown while an itinerary is being built.
 * Just a small spinner and a line or two of text — no card, no progress bar,
 * no cycling steps. Calm and out of the way.
 *
 * Props are kept for compatibility with callers (and so a streamed status
 * message can replace the default subline when available).
 */
export function KanyeQuotes({ destination, realProgress }: KanyeQuotesProps) {
  const heading = destination ? `Building ${destination}…` : 'Building your trip…';
  const subline =
    realProgress?.message ??
    (destination
      ? `Researching ${destination}, picking spots for your taste.`
      : 'Researching spots and pacing your days.');

  return (
    <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
      <Loader2
        className="h-6 w-6 animate-spin text-[color:var(--ink-soft)]"
        strokeWidth={2}
        aria-hidden
      />
      <p className="font-heading text-xl leading-tight text-[color:var(--ink)]">
        {heading}
      </p>
      <p className="max-w-xs text-sm text-[color:var(--ink-muted)]">{subline}</p>
    </div>
  );
}
