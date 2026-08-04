'use client';

import { ChevronUp, ChevronDown } from 'lucide-react';

interface ReorderButtonsProps {
  /** Undefined for the first item — the up button renders disabled. */
  onMoveUp?: () => void;
  /** Undefined for the last item — the down button renders disabled. */
  onMoveDown?: () => void;
  /** Name of the thing being moved, used to build the aria-labels. */
  label: string;
  className?: string;
}

/**
 * Touch-reachable reordering. The desktop path is HTML5 drag-and-drop, which
 * fires no events on touch devices — these buttons drive the same reorder
 * callback and are keyboard- and screen-reader-navigable besides.
 */
export function ReorderButtons({
  onMoveUp,
  onMoveDown,
  label,
  className = '',
}: ReorderButtonsProps) {
  const base =
    'tap-target flex items-center justify-center rounded-full border border-[color:var(--border)] bg-white text-[color:var(--ink-muted)] transition-colors disabled:opacity-30';

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <button
        type="button"
        onClick={onMoveUp}
        disabled={!onMoveUp}
        aria-label={`Move ${label} earlier`}
        className={base}
      >
        <ChevronUp className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={!onMoveDown}
        aria-label={`Move ${label} later`}
        className={base}
      >
        <ChevronDown className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  );
}
