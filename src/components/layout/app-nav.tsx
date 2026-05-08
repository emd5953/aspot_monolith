import { TopNav } from '@/components/ui/top-nav';
import { LogoutButton } from '@/components/auth/logout-button';

/**
 * Shared top nav for authenticated pages.
 */
export function AppNav() {
  return (
    <TopNav
      brandHref="/dashboard"
      links={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Itineraries', href: '/itinerary' },
        { label: 'Trips', href: '/trips' },
        { label: 'Profile', href: '/profile' },
      ]}
      rightSlot={<LogoutButton />}
    />
  );
}
