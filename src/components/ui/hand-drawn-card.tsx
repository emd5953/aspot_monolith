import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface HandDrawnCardProps extends HTMLAttributes<HTMLDivElement> {
  decoration?: 'tape' | 'tack' | 'none';
  variant?: 'default' | 'post-it';
  rotation?: number;
}

export const HandDrawnCard = forwardRef<HTMLDivElement, HandDrawnCardProps>(
  ({ className, decoration = 'none', variant = 'default', rotation, children, ...props }, ref) => {
    const baseStyles = 'border-wobbly-md border-2 border-foreground shadow-hand-subtle p-6 relative';
    
    const variantStyles = {
      default: 'bg-card',
      'post-it': 'bg-post-it',
    };
    
    const rotationStyle = rotation ? { transform: `rotate(${rotation}deg)` } : {};
    
    return (
      <div
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], className)}
        style={rotationStyle}
        {...props}
      >
        {/* Decorations */}
        {decoration === 'tape' && (
          <div 
            className="absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-6 bg-muted/60 border border-foreground/20 rotate-1"
            style={{ borderRadius: '4px' }}
          />
        )}
        {decoration === 'tack' && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-accent rounded-full border-2 border-foreground" />
        )}
        
        {children}
      </div>
    );
  }
);

HandDrawnCard.displayName = 'HandDrawnCard';
