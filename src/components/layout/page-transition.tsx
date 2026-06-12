'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Cross-fade wrapper for protected pages. When the pathname changes,
 * the current children are kept mounted briefly while the new ones fade in,
 * producing a gentle 350ms crossfade over the shared video background.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [displayed, setDisplayed] = useState({ pathname, children });

  // The transition state is *derived*, not stored: whenever the live route
  // differs from the one we've committed to `displayed`, we're mid-swap —
  // fade out. Once the timeout below commits the new route they match again,
  // and the same element's opacity animates back to 1 (the fade-in).
  const transitioning = pathname !== displayed.pathname;

  useEffect(() => {
    if (!transitioning) return;
    // Hold the old content through the fade-out, then commit the new route.
    // (setState here is inside a timeout, not synchronous in the effect.)
    const t = setTimeout(() => {
      setDisplayed({ pathname, children });
    }, 180);
    return () => clearTimeout(t);
  }, [transitioning, pathname, children]);

  // Same route (in-place data updates): show the live children immediately.
  // Mid-transition: hold the previous children until the swap lands.
  const content = transitioning ? displayed.children : children;

  return (
    <div
      className="transition-opacity duration-300 ease-out"
      style={{ opacity: transitioning ? 0 : 1 }}
    >
      {content}
    </div>
  );
}
