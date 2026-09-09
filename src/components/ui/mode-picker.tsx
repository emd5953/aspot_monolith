'use client';

import { Sparkles, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Mode = 'fast' | 'deep';

interface ModePickerProps {
  mode: Mode;
  setMode: (m: Mode) => void;
  /** `cinematic` sits on the video; `paper` sits on a flat page. */
  tone?: 'cinematic' | 'paper';
  disabled?: boolean;
}

/**
 * Fast vs deep research, as one segmented control rather than two loose pills
 * plus a caption. The submit button label ("Plan it" / "Send it") carries the
 * difference in meaning, so no explanatory line is needed here.
 */
export function ModePicker({ mode, setMode, tone = 'paper', disabled }: ModePickerProps) {
  const isCinematic = tone === 'cinematic';

  return (
    <div
      role="radiogroup"
      aria-label="Planning mode"
      className={cn(
        'mx-auto inline-flex rounded-full p-0.5',
        isCinematic
          ? 'border border-white/30 bg-white/15'
          : 'border border-[color:var(--border)] bg-[color:var(--surface)]'
      )}
    >
      <Segment
        icon={Zap}
        label="Fast"
        selected={mode === 'fast'}
        onSelect={() => setMode('fast')}
        disabled={disabled}
        isCinematic={isCinematic}
      />
      <Segment
        icon={Sparkles}
        label="Deep"
        selected={mode === 'deep'}
        onSelect={() => setMode('deep')}
        disabled={disabled}
        isCinematic={isCinematic}
      />
    </div>
  );
}

function Segment({
  icon: Icon,
  label,
  selected,
  onSelect,
  disabled,
  isCinematic,
}: {
  icon: typeof Zap;
  label: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  isCinematic: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium',
        'transition-colors duration-150 disabled:opacity-50',
        selected
          ? isCinematic
            ? 'bg-white text-slate-900'
            : 'bg-[color:var(--ink)] text-white'
          : isCinematic
            ? 'text-white/80 hover:text-white'
            : 'text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]'
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      {label}
    </button>
  );
}
