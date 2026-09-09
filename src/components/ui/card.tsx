import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * `default` — the flat paper card used on working screens.
   * `bare`    — no background or border; just the radius + padding, for
   *             grouping content that shouldn't read as a raised surface.
   */
  variant?: 'default' | 'bare';
  /** Adds hover affordance + pointer cursor. Use when the whole card is a link. */
  interactive?: boolean;
}

/**
 * The one card in the app. Flat surface, hairline border, single soft shadow —
 * no glass, no blur, no stacked shadows. Everything that used to be a
 * `HandDrawnCard` is this.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', interactive, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative rounded-[var(--radius-card)] p-6',
        variant === 'default' &&
          'border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-card)]',
        interactive &&
          'cursor-pointer transition-colors duration-200 hover:border-[color:var(--border-strong)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);

Card.displayName = 'Card';
