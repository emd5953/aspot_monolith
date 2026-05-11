import { TopNav } from '@/components/ui/top-nav';
import { LogoutButton } from '@/components/auth/logout-button';

interface AppNavProps {
  /** Visual tone — `light` when rendered on top of a photo/video hero */
  tone?: 'default' | 'light';
}

/**
 * Shared top nav for authenticated pages.
 */
export function AppNav({ tone = 'default' }: AppNavProps = {}) {
  return (
    <TopNav
      brandHref="/dashboard"
      tone={tone}
      links={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Itineraries', href: '/itinerary' },
        { label: 'Trips', href: '/trips' },
        { label: 'Profile', href: '/profile' },
      ]}
      rightSlot={<LogoutButton tone={tone} />}
    />
  );
}
