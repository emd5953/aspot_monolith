'use client';

import { useEffect, useState } from 'react';

/**
 * Rotating Kanye West quotes shown under the fast-mode loader — a little
 * personality while the itinerary builds. Cycles every few seconds with a
 * soft fade. Quotes are kept lighthearted and motivational.
 */
const KANYE_QUOTES = [
  'I refuse to accept other people’s ideas of happiness for me.',
  'Believe in your flyness, conquer your shyness.',
  'I feel like I’m too busy writing history to read it.',
  'Get up and be active. Make things happen.',
  'I knew I was going to be a star, so I worked harder.',
  'We can do anything if we put our minds to it.',
  'Keep your heart to God, and your face to the rising sun.',
  'Nothing in life is promised except death.',
  'My greatest pain is I’ll never get to watch myself perform live.',
  'I will go down as the voice of this generation.',
];

export function KanyeQuote() {
  const [index, setIndex] = useState(() =>
    Math.floor(Math.random() * KANYE_QUOTES.length)
  );

  useEffect(() => {
    const id = setInterval(
      () => setIndex((prev) => (prev + 1) % KANYE_QUOTES.length),
      4200
    );
    return () => clearInterval(id);
  }, []);

  return (
    <figure className="mt-1 max-w-[21rem]">
      <blockquote
        key={index}
        className="animate-fade-up text-sm font-medium italic leading-relaxed text-white/90 [text-shadow:0_2px_4px_rgba(10,30,60,0.6)]"
      >
        “{KANYE_QUOTES[index]}”
      </blockquote>
      <figcaption className="mt-1.5 text-xs font-semibold not-italic tracking-wide text-white/70 [text-shadow:0_1px_3px_rgba(10,30,60,0.6)]">
        — Ye
      </figcaption>
    </figure>
  );
}
