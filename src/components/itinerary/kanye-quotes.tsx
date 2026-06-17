'use client';

interface KanyeQuotesProps {
  destination?: string;
  realProgress?: { status: string; message: string; progress?: number } | null;
}

/**
 * Loading indicator shown while an itinerary is being built. A compact,
 * boxy silver-glass panel with a quiet spinning ring and an indeterminate
 * hairline along the top edge. Minimal, on-brand with the app's glass
 * surfaces — no progress percentages, no cycling step list.
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
    <div
      className="animate-fade-up relative mx-auto w-full max-w-[19rem] overflow-hidden rounded-2xl border border-white/70 shadow-hand"
      style={{
        background:
          'linear-gradient(145deg, rgba(246,248,251,0.72) 0%, rgba(214,220,229,0.62) 100%)',
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
      }}
    >
      {/* Indeterminate hairline sweeping across the top edge */}
      <div className="absolute inset-x-0 top-0 h-[2px] overflow-hidden bg-[rgba(11,30,60,0.06)]">
        <div
          className="animate-loader-slide h-full w-1/3 rounded-full"
          style={{
            background:
              'linear-gradient(90deg, transparent, var(--ink-soft) 45%, var(--ink) 50%, var(--ink-soft) 55%, transparent)',
          }}
        />
      </div>

      <div className="flex flex-col items-center gap-3.5 px-6 py-7 text-center">
        {/* Quiet spinning ring (silver arc via conic gradient + ring mask) */}
        <div className="relative h-8 w-8">
          <div
            className="animate-ring-spin absolute inset-0 rounded-full"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0%, rgba(11,30,60,0.04) 55%, var(--ink-soft) 88%, var(--ink) 100%)',
              WebkitMask:
                'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px))',
              mask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px))',
            }}
          />
        </div>

        <p className="font-heading text-lg leading-tight text-[color:var(--ink)]">
          {heading}
        </p>
        <p className="max-w-[15rem] text-sm leading-relaxed text-[color:var(--ink-muted)]">
          {subline}
        </p>
      </div>
    </div>
  );
}
