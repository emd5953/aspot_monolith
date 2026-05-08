'use client';

import { useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';

interface EditDayModalProps {
  isOpen: boolean;
  dayNumber: number;
  currentActivities: string[];
  onClose: () => void;
  onSubmit: (prompt: string) => Promise<void>;
}

const EXAMPLES = [
  'I want more food experiences and less museums',
  'Make it more relaxing with spa time',
  'Add adventure activities like hiking',
  'Focus on local culture and hidden gems',
  "I'm feeling tired, make it a lighter day",
];

export function EditDayModal({
  isOpen,
  dayNumber,
  currentActivities,
  onClose,
  onSubmit,
}: EditDayModalProps) {
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(prompt.trim());
      setPrompt('');
      onClose();
    } catch (error) {
      console.error('Failed to edit day:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--ink)]/35 p-4 backdrop-blur-sm">
      <HandDrawnCard className="animate-fade-up max-h-[90vh] w-full max-w-2xl overflow-y-auto p-7">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-[color:var(--ink-muted)]">
              Day {dayNumber}
            </p>
            <h2 className="font-heading text-3xl text-[color:var(--ink)]">
              Tweak this <span className="italic">day</span>.
            </h2>
            <p className="mt-2 text-sm text-[color:var(--ink-muted)]">
              Describe what you want — the AI will regenerate this day accordingly.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--ink-soft)] transition-all hover:border-[color:var(--border-strong)] hover:text-[color:var(--ink)] disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {/* Current Activities */}
        <div className="mb-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
          <p className="mb-2 text-sm font-medium text-[color:var(--ink-muted)]">
            Currently planned
          </p>
          <ul className="space-y-1 text-sm text-[color:var(--ink)]">
            {currentActivities.slice(0, 5).map((activity, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="shrink-0 text-[color:var(--ink-soft)]">·</span>
                {activity}
              </li>
            ))}
            {currentActivities.length > 5 && (
              <li className="text-[color:var(--ink-soft)]">
                … and {currentActivities.length - 5} more
              </li>
            )}
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--ink-muted)]">
              What are you feeling?
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., I want more outdoor activities and less shopping…"
              className="min-h-[120px] w-full resize-none rounded-2xl border border-[color:var(--border)] bg-white px-5 py-3 text-[15px] text-[color:var(--ink)] shadow-[0_2px_10px_-4px_rgba(20,50,100,0.1)] transition-all placeholder:text-[color:var(--ink-soft)] focus:border-[color:var(--accent)]/60 focus:outline-none focus:ring-4 focus:ring-[color:var(--accent)]/15"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {/* Examples */}
          <div>
            <p className="mb-2 text-sm font-medium text-[color:var(--ink-muted)]">
              Try one of these
            </p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((example, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPrompt(example)}
                  disabled={isSubmitting}
                  className="rounded-full border border-[color:var(--border)] bg-white px-3 py-1.5 text-xs text-[color:var(--ink-muted)] transition-all hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--ink)] disabled:opacity-50"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <HandDrawnButton
              type="button"
              onClick={onClose}
              variant="secondary"
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </HandDrawnButton>
            <HandDrawnButton
              type="submit"
              variant="primary"
              disabled={isSubmitting || !prompt.trim()}
              className="flex-1 gap-2"
            >
              {isSubmitting ? 'Regenerating…' : 'Regenerate day'}
              {!isSubmitting && <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />}
            </HandDrawnButton>
          </div>
        </form>

        <p className="mt-4 text-center text-xs text-[color:var(--ink-soft)]">
          Uses real web-scraped data · ~10-20 seconds
        </p>
      </HandDrawnCard>
    </div>
  );
}
