'use client';

import { FormEvent, InputHTMLAttributes, forwardRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PromptInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onSubmit'> {
  onSubmit?: (value: string) => void | Promise<void>;
  submitLabel?: string;
  isSubmitting?: boolean;
  /**
   * `cinematic` — sits on the video (landing, dashboard): solid white pill.
   * `paper`     — sits on a flat page: hairline border, no shadow.
   */
  tone?: 'cinematic' | 'paper';
}

/**
 * The one prompt pill. Previously duplicated three ways — this component, the
 * landing `SkyPrompt`, and `LightPill` inside `itinerary-search` — which is
 * why the three differed in height, radius, and disabled behavior.
 */
export const PromptInput = forwardRef<HTMLInputElement, PromptInputProps>(
  (
    {
      className,
      onSubmit,
      submitLabel = 'Plan it',
      isSubmitting,
      tone = 'paper',
      value,
      defaultValue,
      ...props
    },
    ref
  ) => {
    const [internal, setInternal] = useState<string>((defaultValue as string) ?? '');
    const isControlled = value !== undefined;
    const current = isControlled ? String(value ?? '') : internal;
    const isCinematic = tone === 'cinematic';

    const handleSubmit = async (e: FormEvent) => {
      e.preventDefault();
      if (!current.trim() || isSubmitting) return;
      await onSubmit?.(current.trim());
    };

    return (
      <form
        onSubmit={handleSubmit}
        className={cn(
          'mx-auto flex w-full max-w-xl items-center gap-2 rounded-full py-1.5 pr-1.5 pl-5',
          'transition-colors duration-150',
          isCinematic
            ? 'bg-white focus-within:bg-white'
            : 'border border-[color:var(--border)] bg-[color:var(--surface)] focus-within:border-[color:var(--accent)]/50',
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
          disabled={isSubmitting}
          className={cn(
            'min-w-0 flex-1 bg-transparent py-2.5 outline-none disabled:opacity-70',
            // 16px floor on mobile — iOS Safari auto-zooms below it.
            'text-base',
            isCinematic
              ? 'text-slate-900 placeholder:text-slate-500'
              : 'text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)]'
          )}
          {...props}
        />
        <button
          type="submit"
          aria-label={submitLabel}
          disabled={!current.trim() || isSubmitting}
          className={cn(
            'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-5',
            'bg-[color:var(--ink)] text-sm font-medium text-white',
            'transition-colors duration-150 hover:bg-[color:var(--ink)]/88',
            'disabled:cursor-not-allowed disabled:opacity-40'
          )}
        >
          {isSubmitting ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <>
              {submitLabel}
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            </>
          )}
        </button>
      </form>
    );
  }
);

PromptInput.displayName = 'PromptInput';
