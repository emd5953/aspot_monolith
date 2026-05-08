'use client';

import { useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';

interface RegenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegenerate: (options: {
    useAgenticMode: boolean;
    useTrulyAgentic?: boolean;
    focusAreas?: string[];
  }) => Promise<void>;
}

const FOCUS_OPTIONS = [
  { value: 'food', label: 'Food & dining' },
  { value: 'culture', label: 'Culture & arts' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'relaxation', label: 'Relaxation' },
  { value: 'nightlife', label: 'Nightlife' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'nature', label: 'Nature' },
  { value: 'history', label: 'History' },
];

export function RegenerateModal({ isOpen, onClose, onRegenerate }: RegenerateModalProps) {
  const [mode, setMode] = useState<'agentic' | 'truly-agentic'>('truly-agentic');
  const [selectedFocus, setSelectedFocus] = useState<string[]>([]);
  const [isRegenerating, setIsRegenerating] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setIsRegenerating(true);
    try {
      await onRegenerate({
        useAgenticMode: true,
        useTrulyAgentic: mode === 'truly-agentic',
        focusAreas: selectedFocus.length > 0 ? selectedFocus : undefined,
      });
      onClose();
    } catch (error) {
      console.error('Regeneration failed:', error);
    } finally {
      setIsRegenerating(false);
    }
  };

  const toggleFocus = (value: string) => {
    setSelectedFocus((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--ink)]/35 p-4 backdrop-blur-sm">
      <HandDrawnCard className="animate-fade-up max-h-[90vh] w-full max-w-lg overflow-y-auto p-7">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-[color:var(--ink-muted)]">Regenerate</p>
            <h2 className="font-heading text-3xl text-[color:var(--ink)]">
              Refresh this <span className="italic">itinerary</span>.
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--ink-soft)] transition-all hover:border-[color:var(--border-strong)] hover:text-[color:var(--ink)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <p className="mb-6 text-sm text-[color:var(--ink-muted)]">
          Create a fresh version of your itinerary with new recommendations.
        </p>

        {/* Mode Selection */}
        <div className="mb-6">
          <p className="mb-3 text-sm font-medium text-[color:var(--ink-muted)]">
            Generation mode
          </p>
          <div className="space-y-2">
            <ModeOption
              selected={mode === 'truly-agentic'}
              onClick={() => setMode('truly-agentic')}
              title="Best quality"
              subtitle="Full reasoning chains and web research"
            />
            <ModeOption
              selected={mode === 'agentic'}
              onClick={() => setMode('agentic')}
              title="Standard agentic"
              subtitle="Multi-agent pipeline with review loops"
            />
          </div>
        </div>

        {/* Focus Areas */}
        <div className="mb-8">
          <p className="mb-1 text-sm font-medium text-[color:var(--ink-muted)]">
            Focus areas (optional)
          </p>
          <p className="mb-3 text-xs text-[color:var(--ink-soft)]">
            Pick themes to emphasize in the new plan.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {FOCUS_OPTIONS.map((option) => {
              const selected = selectedFocus.includes(option.value);
              return (
                <button
                  key={option.value}
                  onClick={() => toggleFocus(option.value)}
                  className={`rounded-full border px-3 py-2 text-sm transition-all ${
                    selected
                      ? 'border-[color:var(--ink)] bg-[color:var(--ink)] text-white'
                      : 'border-[color:var(--border)] bg-white text-[color:var(--ink)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-soft)]'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <HandDrawnButton
            onClick={onClose}
            variant="secondary"
            disabled={isRegenerating}
            className="flex-1"
          >
            Cancel
          </HandDrawnButton>
          <HandDrawnButton
            onClick={handleSubmit}
            variant="primary"
            disabled={isRegenerating}
            className="flex-1 gap-2"
          >
            {isRegenerating ? 'Regenerating…' : 'Regenerate'}
            {!isRegenerating && <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />}
          </HandDrawnButton>
        </div>
      </HandDrawnCard>
    </div>
  );
}

function ModeOption({
  selected,
  onClick,
  title,
  subtitle,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition-all ${
        selected
          ? 'border-[color:var(--ink)] bg-[color:var(--ink)] text-white'
          : 'border-[color:var(--border)] bg-white text-[color:var(--ink)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-soft)]'
      }`}
    >
      <div className="font-heading text-lg leading-none">{title}</div>
      <div className={`mt-1.5 text-xs ${selected ? 'text-white/75' : 'text-[color:var(--ink-muted)]'}`}>
        {subtitle}
      </div>
    </button>
  );
}
