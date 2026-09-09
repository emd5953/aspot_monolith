'use client';

import { usePathname } from 'next/navigation';
import { CoverVideo } from '@/components/landing/cover-video';
import { surfaceFor } from '@/components/ui/surface';

/**
 * Paints the background for authenticated routes, picking the surface from the
 * pathname (see `surfaceFor`).
 *
 * Cinematic routes keep the video and one scrim. Paper routes get a flat
 * surface and no video at all — previously every interior page rendered dense
 * content over moving footage, which is what forced the text-shadow stacks and
 * frosted-glass pills that made the app feel loud.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const surface = surfaceFor(usePathname());

  if (surface === 'paper') {
    return (
      <div className="relative min-h-screen overflow-x-hidden bg-[color:var(--surface-page)] text-[color:var(--ink)]">
        {children}
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden text-white">
      <div className="fixed inset-0 z-0">
        <CoverVideo src="/cover2.mp4" poster="/cover2-poster.jpg" vignette={0.3} />
      </div>

      {/* One scrim, centred on the hero copy. The old three-stop linear
          gradient existed to rescue text that no longer sits here. */}
      <div
        className="pointer-events-none fixed inset-0 z-[1]"
        aria-hidden
        style={{
          background:
            'radial-gradient(60% 45% at 50% 50%, rgba(10,25,55,0.38) 0%, rgba(10,25,55,0.14) 55%, transparent 80%)',
        }}
      />

      {children}
    </div>
  );
}
