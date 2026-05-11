'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(callback: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

interface CoverVideoProps {
  /** Path to the optimized .mp4 source, relative to /public */
  src?: string;
  /** Poster image used for first paint and as a reduced-motion fallback */
  poster?: string;
  /** Strength of the top→bottom vignette (0-1). Defaults to a subtle 0.25. */
  vignette?: number;
}

/**
 * Full-bleed background video. Uses a poster for instant paint and falls back
 * to the poster when the user prefers reduced motion or autoplay is blocked.
 */
export function CoverVideo({
  src = '/cover.mp4',
  poster = '/cover-poster.jpg',
  vignette = 0.25,
}: CoverVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reducedMotion = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (reducedMotion) {
      v.pause();
    } else {
      v.play().catch(() => {
        /* autoplay blocked — poster stays visible, no-op */
      });
    }
  }, [reducedMotion]);

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {!reducedMotion && (
        <video
          ref={videoRef}
          key={src}
          className="h-full w-full object-cover"
          src={src}
          poster={poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      )}
      {reducedMotion && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" className="h-full w-full object-cover" />
      )}
      {/* Subtle vignette so text stays readable at the top and bottom edges */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background: `linear-gradient(to bottom, rgba(0,0,0,${vignette * 0.4}) 0%, transparent 35%, transparent 65%, rgba(0,0,0,${vignette}) 100%)`,
        }}
      />
    </div>
  );
}
