'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Map, User, type LucideIcon } from 'lucide-react';

export interface BottomTab {
  label: string;
  href: string;
  icon: LucideIcon;
}

const TABS: BottomTab[] = [
  { label: 'Home', href: '/dashboard', icon: Home },
  { label: 'Moves', href: '/itinerary', icon: Map },
  { label: 'Profile', href: '/profile', icon: User },
];

/**
 * Mobile navigation. The top nav hides its links below `md`, which used to
 * leave phones with no way to reach anything but the dashboard — this is the
 * replacement, not an addition: it renders only below `md`.
 *
 * Thumb-reachable, three fixed destinations, current route filled. Icon-only:
 * three distinct glyphs carry the meaning, and the labels were the last words
 * pinned to the bottom of every screen.
 */
export function BottomTabs({ tabs = TABS }: { tabs?: BottomTab[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      // Deliberately opaque, not the `glass-nav` treatment used elsewhere:
      // at 72% white the page text scrolled straight through the bar and
      // collided with the tab labels.
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--border)] bg-[color:var(--surface)] md:hidden"
    >
      <ul className="flex items-stretch justify-around">
        {tabs.map((tab) => {
          // Prefix match so /itinerary/[id] keeps the Itineraries tab lit.
          const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
                className={`tap-target flex items-center justify-center px-1 py-2 transition-colors ${
                  isActive ? 'text-[color:var(--ink)]' : 'text-[color:var(--ink-soft)]'
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
