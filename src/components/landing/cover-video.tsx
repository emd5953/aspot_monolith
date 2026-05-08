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

/**
 * Full-bleed background video for the landing hero. Uses a poster image for
 * instant paint and falls back to the poster if the user prefers reduced
 * motion or autoplay is blocked.
 */
export function CoverVideo() {
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
          className="h-full w-full object-cover"
          src="/cover.mp4"
          poster="/cover-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      )}
      {reducedMotion && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/cover-poster.jpg"
          alt=""
          className="h-full w-full object-cover"
        />
      )}
      {/* Subtle vignette so text stays readable at the top and bottom edges */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/25"
        aria-hidden
      />
    </div>
  );
}
