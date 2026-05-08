import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface HandDrawnButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Rounded pill button. Name preserved for import compatibility.
 * Tuned for the daytime sky palette: dark ink primary, soft glass secondary.
 */
export const HandDrawnButton = forwardRef<HTMLButtonElement, HandDrawnButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center gap-2 rounded-full font-medium ' +
      'transition-all duration-200 ease-out select-none ' +
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ' +
      'focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent';

    const variantStyles: Record<string, string> = {
      // Primary: solid dark ink pill — the hero CTA
      primary:
        'bg-[color:var(--ink)] text-white hover:bg-[color:var(--ink)]/92 ' +
        'shadow-[0_12px_28px_-14px_rgba(11,30,60,0.5)] hover:-translate-y-[1px] active:translate-y-0',
      // Secondary: soft white glass pill
      secondary:
        'bg-white/80 text-[color:var(--ink)] border border-white ' +
        'shadow-[0_8px_20px_-12px_rgba(20,50,100,0.25)] backdrop-blur-md ' +
        'hover:bg-white hover:-translate-y-[1px] active:translate-y-0',
      // Accent: sky-blue pill for playful CTAs
      accent:
        'bg-[color:var(--accent)] text-white hover:bg-[color:var(--accent)]/92 ' +
        'shadow-[0_12px_28px_-14px_rgba(47,111,216,0.6)] hover:-translate-y-[1px] active:translate-y-0',
      // Ghost: text-only
      ghost:
        'bg-transparent text-[color:var(--ink-muted)] hover:text-[color:var(--ink)] hover:bg-white/50',
    };

    const sizeStyles: Record<string, string> = {
      sm: 'px-4 py-1.5 text-sm',
      md: 'px-5 py-2.5 text-sm',
      lg: 'px-7 py-3.5 text-base',
    };

    return (
      <button
        ref={ref}
        className={cn(base, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

HandDrawnButton.displayName = 'HandDrawnButton';
