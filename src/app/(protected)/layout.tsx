import { CoverVideo } from '@/components/landing/cover-video';
import { AppNav } from '@/components/layout/app-nav';
import { PageTransition } from '@/components/layout/page-transition';

/**
 * Shared frame for every authenticated page.
 * The cover video + nav are mounted once here so they persist across
 * route changes without restarting. Page content cross-fades on navigation.
 */
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-x-hidden text-white">
      {/* Shared atmospheric background */}
      <div className="fixed inset-0 z-0">
        <CoverVideo src="/cover2.mp4" poster="/cover2-poster.jpg" vignette={0.3} />
      </div>

      {/* Subtle scrim so dense content stays readable on bright cloud frames */}
      <div
        className="pointer-events-none fixed inset-0 z-[1]"
        aria-hidden
        style={{
          background:
            'linear-gradient(to bottom, rgba(10,25,55,0.3) 0%, rgba(10,25,55,0.15) 35%, rgba(10,25,55,0.1) 65%, rgba(10,25,55,0.35) 100%)',
        }}
      />

      {/* Nav sits above the video */}
      <div className="relative z-20">
        <AppNav tone="light" />
      </div>

      {/* Page content — cross-fades between routes */}
      <div className="relative z-10">
        <PageTransition>{children}</PageTransition>
      </div>
    </div>
  );
}
