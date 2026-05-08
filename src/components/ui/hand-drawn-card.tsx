import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface HandDrawnCardProps extends HTMLAttributes<HTMLDivElement> {
  decoration?: 'tape' | 'tack' | 'none';
  variant?: 'default' | 'post-it' | 'solid';
  rotation?: number;
}

/**
 * Soft white card for the daytime sky theme. Name preserved for import
 * compatibility. `decoration` and `rotation` are accepted but intentionally
 * no-op'd — the old tape/tack visuals don't fit the new aesthetic.
 */
export const HandDrawnCard = forwardRef<HTMLDivElement, HandDrawnCardProps>(
  (
    { className, decoration: _decoration, variant = 'default', rotation: _rotation, children, ...props },
    ref
  ) => {
    void _decoration;
    void _rotation;

    const base = 'relative rounded-3xl p-6 transition-all duration-300 ease-out';

    const variantStyles: Record<string, string> = {
      default:
        'bg-white/85 border border-white backdrop-blur-xl ' +
        'shadow-[0_18px_40px_-20px_rgba(20,50,100,0.22)]',
      'post-it':
        'bg-[color:var(--post-it)] text-[color:var(--ink)] border border-amber-200/80 ' +
        'shadow-[0_14px_30px_-16px_rgba(120,90,10,0.3)]',
      solid:
        'bg-white text-[color:var(--ink)] border border-white ' +
        'shadow-[0_18px_40px_-20px_rgba(20,50,100,0.22)]',
    };

    return (
      <div
        ref={ref}
        className={cn(base, variantStyles[variant], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

HandDrawnCard.displayName = 'HandDrawnCard';
