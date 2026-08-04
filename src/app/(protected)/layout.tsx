import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CoverVideo } from '@/components/landing/cover-video';
import { AppNav } from '@/components/layout/app-nav';
import { PageTransition } from '@/components/layout/page-transition';
import { BottomTabs } from '@/components/layout/bottom-tabs';

/**
 * Shared frame for every authenticated page.
 * The cover video + nav are mounted once here so they persist across
 * route changes without restarting. Page content cross-fades on navigation.
 *
 * Auth is enforced here, once, for the whole route group. Individual pages
 * used to each call getUser()/redirect — and several (itinerary, trips,
 * profile/edit, the [id] detail pages) forgot, leaving them reachable while
 * signed out. Guarding in the layout closes that hole structurally: no page
 * under (protected) can render without a session. Pages may still do their own
 * finer-grained redirects (e.g. profile → /quiz when onboarding is incomplete).
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

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

      {/* Page content — cross-fades between routes.
          Bottom padding clears the mobile tab bar; no-op from md up.

          BottomTabs is mounted *inside* this z-10 wrapper on purpose: the
          wrapper is a stacking context, so a modal rendered by a page (z-50)
          only outranks the tab bar (z-40) if both sit in the same context.
          Hoisting the bar to a sibling would put it over every open modal. */}
      <div className="relative z-10 pb-20 md:pb-0">
        <PageTransition>{children}</PageTransition>
        <BottomTabs />
      </div>
    </div>
  );
}
