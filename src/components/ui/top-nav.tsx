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
   * - `light`: transparent/white text, for use over a photo or video hero
   */
  tone?: 'default' | 'light';
}

/**
 * Floating top nav. Two tones:
 * - default: white frosted pill that sits on the sky-wash background
 * - light: transparent with white text for photo/video hero sections
 */
export function TopNav({
  links = [],
  rightSlot,
  brandHref = '/',
  className,
  tone = 'default',
}: TopNavProps) {
  const isLight = tone === 'light';
  const textShadow = isLight
    ? '[text-shadow:0_1px_3px_rgba(10,30,60,0.45),0_4px_16px_rgba(10,30,60,0.35)]'
    : '';

  return (
    <header
      className={cn(
        'left-0 right-0 top-0 z-50 px-4 pt-4',
        isLight ? 'relative' : 'fixed',
        className
      )}
    >
      <div className="mx-auto max-w-6xl">
        <nav
          className={cn(
            'flex items-center justify-between gap-4 rounded-full px-5 py-2.5',
            isLight ? 'bg-transparent' : 'glass-nav'
          )}
        >
          {/* Brand */}
          <Link
            href={brandHref}
            aria-label="aSpot home"
            className="group flex shrink-0 items-center gap-2"
          >
            <span
              className={cn(
                'relative inline-flex h-7 w-7 items-center justify-center rounded-full border transition-all',
                isLight
                  ? 'border-white/50 bg-white/10 group-hover:border-white/80'
                  : 'border-[color:var(--border)] bg-white group-hover:border-[color:var(--border-strong)]'
              )}
            >
              <span
                className={cn(
                  'block h-2 w-2 rounded-full',
                  isLight ? 'bg-white' : 'bg-[color:var(--accent)]'
                )}
              />
            </span>
            <span
              className={cn(
                'hidden font-heading text-xl leading-none sm:inline-flex',
                isLight ? `text-white ${textShadow}` : 'text-[color:var(--ink)]'
              )}
            >
              aSpot
            </span>
          </Link>

          {/* Center links */}
          <ul className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    'rounded-full px-3 py-2 text-sm font-medium transition-colors',
                    isLight
                      ? `text-white/90 hover:bg-white/10 hover:text-white ${textShadow}`
                      : 'text-[color:var(--ink-muted)] hover:bg-white/60 hover:text-[color:var(--ink)]'
                  )}
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
