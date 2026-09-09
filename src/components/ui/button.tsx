import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * `primary` — ink fill, the one CTA on a screen.
   * `quiet`   — hairline border on the page surface.
   * `ghost`   — text only, for tertiary actions and icon buttons.
   */
  variant?: 'primary' | 'quiet' | 'ghost';
  size?: 'sm' | 'md';
}

/**
 * The one button in the app. No lift-on-hover, no layered shadow — colour
 * change alone carries the interaction.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 rounded-full font-medium',
        'transition-colors duration-150',
        'focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'primary' &&
          'bg-[color:var(--ink)] text-white hover:bg-[color:var(--ink)]/88',
        variant === 'quiet' &&
          'border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--ink)] hover:border-[color:var(--border-strong)]',
        variant === 'ghost' &&
          'text-[color:var(--ink-muted)] hover:bg-[color:var(--ink)]/5 hover:text-[color:var(--ink)]',
        size === 'sm' && 'px-4 py-1.5 text-sm',
        size === 'md' && 'px-5 py-2.5 text-sm',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);

Button.displayName = 'Button';
