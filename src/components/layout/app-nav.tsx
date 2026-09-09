'use client';

import { usePathname } from 'next/navigation';
import { TopNav } from '@/components/ui/top-nav';
import { LogoutButton } from '@/components/auth/logout-button';
import { surfaceFor } from '@/components/ui/surface';

/**
 * Shared top nav for authenticated pages. Tone is derived from the route in
 * this one place rather than threaded as a prop through every page — the two
 * used to drift, leaving white nav text on a white interior page.
 */
export function AppNav() {
  const surface = surfaceFor(usePathname());

  return (
    <TopNav
      brandHref="/dashboard"
      tone={surface}
      links={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Moves', href: '/itinerary' },
        { label: 'Profile', href: '/profile' },
      ]}
      rightSlot={<LogoutButton tone={surface} />}
    />
  );
}
