'use client';

import { cn } from '@/lib/utils';

interface Option {
  value: string;
  label: string;
  emoji?: string;
}

interface PillPickerProps<T extends string | string[]> {
  label: string;
  subtext?: string;
  options: Option[];
  value: T;
  onChange: (next: T) => void;
  /** Max selections for multi-select */
  max?: number;
}

/**
 * Pill-style selector. Renders either as radio (single-select) or checkbox-like
 * (multi-select, when `value` is an array). No save button — onChange fires on
 * each toggle; parent handles autosave.
 */
export function PillPicker<T extends string | string[]>({
  label,
  subtext,
  options,
  value,
  onChange,
  max,
}: PillPickerProps<T>) {
  const isMulti = Array.isArray(value);
  const selectedSet = new Set(isMulti ? (value as string[]) : [value as string]);

  const toggle = (optionValue: string) => {
    if (isMulti) {
      const current = value as string[];
      const exists = current.includes(optionValue);
      if (exists) {
        onChange(current.filter((v) => v !== optionValue) as T);
      } else {
        if (max && current.length >= max) return;
        onChange([...current, optionValue] as T);
      }
    } else {
      onChange(optionValue as T);
    }
  };

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h3 className="font-heading text-xl text-[color:var(--ink)]">{label}</h3>
        {isMulti && max !== undefined && (
          <span className="text-xs text-[color:var(--ink-soft)]">
            {(value as string[]).length}/{max}
          </span>
        )}
      </div>
      {subtext && (
        <p className="mt-1 text-sm text-[color:var(--ink-muted)]">{subtext}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = selectedSet.has(option.value);
          const disabled =
            isMulti &&
            !selected &&
            max !== undefined &&
            (value as string[]).length >= max;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggle(option.value)}
              disabled={disabled}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all',
                'disabled:cursor-not-allowed disabled:opacity-40',
                selected
                  ? 'border-[color:var(--ink)] bg-[color:var(--ink)] text-white shadow-[0_8px_22px_-10px_rgba(11,30,60,0.55)]'
                  : 'border-[color:var(--border)] bg-white text-[color:var(--ink)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-soft)]'
              )}
            >
              {option.emoji && <span aria-hidden>{option.emoji}</span>}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
