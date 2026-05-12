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
  /**
   * Visual tone:
   * - `default` (light): white frosted pill on light pages
   * - `light`: transparent, white text, matches the landing nav
   */
  tone?: 'default' | 'light';
}

/**
 * Floating top nav. Two tones:
 * - default: white frosted pill that sits on the sky-wash background
 * - light: plain transparent bar with a simple wordmark — matches landing
 */
export function TopNav({
  links = [],
  rightSlot,
  brandHref = '/',
  className,
  tone = 'default',
}: TopNavProps) {
  const isLight = tone === 'light';

  // Landing-style nav: no pill, just a plain flex bar with the wordmark
  // and right-side actions. Links render as simple inline text.
  if (isLight) {
    const textShadow =
      '[text-shadow:0_1px_3px_rgba(10,30,60,0.45),0_4px_16px_rgba(10,30,60,0.35)]';

    return (
      <header
        className={cn(
          'relative z-50 px-6 pt-6 md:px-10',
          className
        )}
      >
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link
            href={brandHref}
            aria-label="aSpot home"
            className={`font-heading text-2xl leading-none text-white ${textShadow}`}
          >
            aSpot
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:text-white ${textShadow}`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {rightSlot}
          </div>
        </nav>
      </header>
    );
  }

  // Default tone — used on light-page pages (no photo/video hero)
  return (
    <header
      className={cn(
        'left-0 right-0 top-0 z-50 fixed px-4 pt-4',
        className
      )}
    >
      <div className="mx-auto max-w-6xl">
        <nav className="glass-nav flex items-center justify-between gap-4 rounded-full px-5 py-2.5">
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

          <ul className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-full px-3 py-2 text-sm font-medium text-[color:var(--ink-muted)] transition-colors hover:bg-white/60 hover:text-[color:var(--ink)]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex shrink-0 items-center gap-2">{rightSlot}</div>
        </nav>
      </div>
    </header>
  );
}
