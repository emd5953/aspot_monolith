import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface HandDrawnInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

/**
 * Soft-ink input for the daytime sky theme. Name preserved for import
 * compatibility.
 */
export const HandDrawnInput = forwardRef<HTMLInputElement, HandDrawnInputProps>(
  ({ className, label, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-2 block text-sm font-medium text-[color:var(--ink-muted)]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-2xl border px-5 py-3',
            'border-[color:var(--border)] bg-white',
            'font-body text-[15px] text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)]',
            'transition-all duration-200',
            'focus:border-[color:var(--accent)]/60 focus:outline-none focus:ring-4 focus:ring-[color:var(--accent)]/15',
            'shadow-[0_2px_10px_-4px_rgba(20,50,100,0.1)]',
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

HandDrawnInput.displayName = 'HandDrawnInput';
