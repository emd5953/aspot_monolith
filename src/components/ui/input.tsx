import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

/**
 * The one text input in the app. Flat, hairline border, accent focus ring.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
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
            'w-full rounded-[var(--radius-card)] border px-4 py-3',
            'border-[color:var(--border)] bg-[color:var(--surface)]',
            // 16px floor on mobile — iOS Safari auto-zooms the viewport on any
            // input below it. Back to the designed 15px from md up.
            'font-body text-base text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)] md:text-[15px]',
            'transition-colors duration-150',
            'focus:border-[color:var(--accent)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/20',
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = 'Input';
