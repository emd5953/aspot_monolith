'use client';

import { useEffect, useState, CSSProperties } from 'react';
import Link from 'next/link';

interface FloatingHintProps {
  href: string;
  /** One short line, like a thought bubble */
  message: string;
  /** The action label on the link */
  cta: string;
  /** Absolute positioning on the hero — use percent values so it stays responsive */
  position: Pick<CSSProperties, 'top' | 'bottom' | 'left' | 'right'>;
  /** Milliseconds before the "…" bubble appears */
  appearDelay?: number;
  /** Milliseconds (after appear) before the bubble expands into the card */
  expandAfter?: number;
  /** Slight rotation for hand-placed feel (degrees) */
  rotate?: number;
}

type Phase = 'hidden' | 'dots' | 'expanded';

/**
 * A playful thought-bubble that fades out of the clouds as "…", then blooms
 * into a tiny CTA card. On hover, tilts gently.
 */
export function FloatingHint({
  href,
  message,
  cta,
  position,
  appearDelay = 1200,
  expandAfter = 1800,
  rotate = 0,
}: FloatingHintProps) {
  const [phase, setPhase] = useState<Phase>('hidden');
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('dots'), appearDelay);
    const t2 = setTimeout(() => setPhase('expanded'), appearDelay + expandAfter);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [appearDelay, expandAfter]);

  if (phase === 'hidden') return null;

  // Tilt a few extra degrees on hover, keeping the baseline rotation.
  const tilt = hovered ? rotate + 3 : rotate;

  return (
    <div
      className="pointer-events-none absolute z-20 hidden transition-transform duration-300 ease-out md:block"
      style={{ ...position, transform: `rotate(${tilt}deg)` }}
    >
      {phase === 'dots' ? (
        <button
          type="button"
          onClick={() => setPhase('expanded')}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          aria-label={message}
          className="pointer-events-auto animate-float-in animate-gentle-bounce flex items-center gap-1 rounded-full bg-white/80 px-4 py-3 shadow-[0_10px_28px_-10px_rgba(10,25,55,0.45)] backdrop-blur-md transition-colors hover:bg-white"
        >
          <Dot delay={0} />
          <Dot delay={180} />
          <Dot delay={360} />
        </button>
      ) : (
        <Link
          href={href}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="pointer-events-auto animate-pop-open block w-[240px] rounded-2xl bg-white/92 px-4 py-3.5 shadow-[0_14px_36px_-12px_rgba(10,25,55,0.45)] backdrop-blur-md transition-shadow duration-300 hover:shadow-[0_20px_44px_-12px_rgba(10,25,55,0.55)]"
        >
          <p className="text-sm leading-snug text-slate-600">{message}</p>

          <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-slate-700">
            {cta}
            <span
              className={`inline-block transition-transform duration-300 ${hovered ? 'translate-x-1' : ''}`}
            >
              →
            </span>
          </span>
        </Link>
      )}
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="block h-1.5 w-1.5 rounded-full bg-slate-500"
      style={{
        animation: 'dot-bob 1.4s ease-in-out infinite',
        animationDelay: `${delay}ms`,
      }}
    />
  );
}
