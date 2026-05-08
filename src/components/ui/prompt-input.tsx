'use client';

import { FormEvent, InputHTMLAttributes, forwardRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PromptInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onSubmit'> {
  onSubmit?: (value: string) => void | Promise<void>;
  submitLabel?: string;
  isSubmitting?: boolean;
}

/**
 * Pill-shaped prompt input with an inline dark CTA.
 * Tuned for light surfaces (on-page use, not on a photo).
 */
export const PromptInput = forwardRef<HTMLInputElement, PromptInputProps>(
  ({ className, onSubmit, submitLabel = 'Submit', isSubmitting, value, defaultValue, ...props }, ref) => {
    const [internal, setInternal] = useState<string>((defaultValue as string) ?? '');
    const isControlled = value !== undefined;
    const current = isControlled ? String(value ?? '') : internal;

    const handleSubmit = async (e: FormEvent) => {
      e.preventDefault();
      if (!current.trim() || isSubmitting) return;
      await onSubmit?.(current.trim());
    };

    return (
      <form
        onSubmit={handleSubmit}
        className={cn(
          'group relative flex w-full items-center gap-2',
          'rounded-full border border-white bg-white py-1.5 pr-1.5 pl-6',
          'shadow-[0_18px_40px_-18px_rgba(20,50,100,0.25)] transition-all duration-200',
          'focus-within:border-[color:var(--accent)]/40 focus-within:ring-4 focus-within:ring-[color:var(--accent)]/12',
          className
        )}
      >
        <input
          ref={ref}
          value={current}
          onChange={(e) => {
            if (!isControlled) setInternal(e.target.value);
            props.onChange?.(e);
          }}
          className="flex-1 bg-transparent py-2.5 text-base text-[color:var(--ink)] outline-none placeholder:text-[color:var(--ink-soft)]"
          {...props}
        />
        <button
          type="submit"
          aria-label={submitLabel}
          disabled={!current.trim() || isSubmitting}
          className={cn(
            'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-5',
            'bg-[color:var(--ink)] text-sm font-medium text-white transition-all duration-200',
            'hover:bg-[color:var(--ink)]/90 hover:-translate-y-[1px]',
            'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0'
          )}
        >
          {isSubmitting ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <>
              {submitLabel}
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </>
          )}
        </button>
      </form>
    );
  }
);

PromptInput.displayName = 'PromptInput';
