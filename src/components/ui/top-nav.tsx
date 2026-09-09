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
   * `cinematic` — transparent bar over the video, white text.
   * `paper`     — hairline bottom border on the flat page surface.
   */
  tone?: 'cinematic' | 'paper';
}

/**
 * Top nav. Both tones are the same plain flex bar; only the colours differ.
 * The paper tone used to be a floating frosted pill, which meant page content
 * scrolled visibly through the nav.
 */
export function TopNav({
  links = [],
  rightSlot,
  brandHref = '/',
  className,
  tone = 'paper',
}: TopNavProps) {
  const isCinematic = tone === 'cinematic';

  return (
    <header
      className={cn(
        'relative z-50 px-5 py-4 md:px-8',
        !isCinematic && 'border-b border-[color:var(--border)] bg-[color:var(--surface-page)]',
        className
      )}
    >
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <Link
          href={brandHref}
          aria-label="Spotz home"
          className={cn(
            'font-heading text-2xl leading-none',
            isCinematic ? 'text-white' : 'text-[color:var(--ink)]'
          )}
        >
          Spotz
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-full px-3 py-2 text-sm font-medium transition-colors',
                isCinematic
                  ? 'text-white/85 hover:text-white'
                  : 'text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]'
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">{rightSlot}</div>
      </nav>
    </header>
  );
}
