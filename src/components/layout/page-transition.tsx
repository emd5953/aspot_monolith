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
  const [fadedOut, setFadedOut] = useState(false);

  useEffect(() => {
    if (pathname === displayed.pathname) {
      // Same path — just refresh the children reference (data updates, etc.)
      setDisplayed({ pathname, children });
      return;
    }

    // Route changed: fade out the old content, swap, fade in.
    setFadedOut(true);
    const t = setTimeout(() => {
      setDisplayed({ pathname, children });
      // Next paint, fade in
      requestAnimationFrame(() => setFadedOut(false));
    }, 180);
    return () => clearTimeout(t);
  }, [pathname, children, displayed.pathname]);

  return (
    <div
      className="transition-opacity duration-300 ease-out"
      style={{ opacity: fadedOut ? 0 : 1 }}
    >
      {displayed.children}
    </div>
  );
}
