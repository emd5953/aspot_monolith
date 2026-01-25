import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface HandDrawnInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const HandDrawnInput = forwardRef<HTMLInputElement, HandDrawnInputProps>(
  ({ className, label, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    
    return (
      <div className="w-full">
        {label && (
          <label 
            htmlFor={inputId}
            className="block text-foreground font-body text-lg mb-2"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full px-4 py-3 bg-card border-2 border-foreground border-wobbly-sm',
            'font-body text-base text-foreground placeholder:text-foreground/40',
            'focus:outline-none focus:border-secondary-accent focus:ring-2 focus:ring-secondary-accent/20',
            'transition-all duration-100',
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

HandDrawnInput.displayName = 'HandDrawnInput';
