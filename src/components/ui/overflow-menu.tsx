'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MenuAction {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  /** Renders in the destructive tone and sits last. */
  destructive?: boolean;
  href?: string;
  download?: boolean;
}

/**
 * A "⋯" button that opens a small action list. Replaces rows of four or five
 * equally-weighted pills, where nothing read as primary and the row wrapped
 * raggedly on phones.
 */
export function OverflowMenu({
  actions,
  label = 'More actions',
}: {
  actions: MenuAction[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        className="tap-target flex items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--ink-muted)] transition-colors hover:border-[color:var(--border-strong)] hover:text-[color:var(--ink)] md:h-9 md:w-9 md:min-h-0 md:min-w-0"
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-30 mt-2 min-w-[180px] overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-card)]"
        >
          {actions.map((action) => {
            const className = cn(
              'flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors',
              action.destructive
                ? 'text-rose-600 hover:bg-rose-50'
                : 'text-[color:var(--ink)] hover:bg-[color:var(--surface-soft)]'
            );

            if (action.href) {
              return (
                <a
                  key={action.label}
                  role="menuitem"
                  href={action.href}
                  download={action.download}
                  onClick={() => setOpen(false)}
                  className={className}
                >
                  {action.icon}
                  {action.label}
                </a>
              );
            }

            return (
              <button
                key={action.label}
                role="menuitem"
                type="button"
                onClick={() => {
                  action.onSelect();
                  setOpen(false);
                }}
                className={className}
              >
                {action.icon}
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
