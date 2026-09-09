import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/app-shell';
import { AppNav } from '@/components/layout/app-nav';
import { PageTransition } from '@/components/layout/page-transition';
import { BottomTabs } from '@/components/layout/bottom-tabs';

/**
 * Shared frame for every authenticated page. `AppShell` owns the background
 * and picks cinematic vs paper from the route; the nav and tabs mount once
 * here so they persist across route changes.
 *
 * Auth is enforced here, once, for the whole route group. Individual pages
 * used to each call getUser()/redirect — and several (itinerary, trips,
 * profile/edit, the [id] detail pages) forgot, leaving them reachable while
 * signed out. Guarding in the layout closes that hole structurally: no page
 * under (protected) can render without a session. Pages may still do their own
 * finer-grained redirects.
 */
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  return (
    <AppShell>
      <div className="relative z-20">
        <AppNav />
      </div>

      {/* Page content — cross-fades between routes.
          Bottom padding clears the mobile tab bar; no-op from md up.

          BottomTabs is mounted *inside* this z-10 wrapper on purpose: the
          wrapper is a stacking context, so a modal rendered by a page (z-50)
          only outranks the tab bar (z-40) if both sit in the same context.
          Hoisting the bar to a sibling would put it over every open modal. */}
      <div className="relative z-10 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
        <PageTransition>{children}</PageTransition>
        <BottomTabs />
      </div>
    </AppShell>
  );
}
