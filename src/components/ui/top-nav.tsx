import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

export interface NavLink {
  label: string;
  href: string;
}

interface TopNavProps {
  links?: NavLink[];
  rightSlot?: ReactNode;
  brandHref?: string;
  className?: string;
}

/**
 * Floating glass nav bar. Daytime-sky styling: white frosted pill,
 * dark ink text, soft rounded links. Wordmark uses the display serif.
 */
export function TopNav({ links = [], rightSlot, brandHref = '/', className }: TopNavProps) {
  return (
    <header className={cn('fixed top-0 right-0 left-0 z-50 px-4 pt-4', className)}>
      <div className="mx-auto max-w-6xl">
        <nav className="glass-nav flex items-center justify-between gap-4 rounded-full px-5 py-2.5">
          {/* Brand */}
          <Link
            href={brandHref}
            aria-label="aSpot home"
            className="group flex shrink-0 items-center gap-2"
          >
            <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--border)] bg-white transition-all group-hover:border-[color:var(--border-strong)]">
              <span className="block h-2 w-2 rounded-full bg-[color:var(--accent)]" />
            </span>
            <span className="hidden font-heading text-xl leading-none text-[color:var(--ink)] sm:inline-flex">
              aSpot
            </span>
          </Link>

          {/* Center links */}
          <ul className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-full px-3 py-2 text-sm text-[color:var(--ink-muted)] transition-colors hover:bg-white/60 hover:text-[color:var(--ink)]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Right slot */}
          <div className="flex shrink-0 items-center gap-2">{rightSlot}</div>
        </nav>
      </div>
    </header>
  );
}
