'use client';

import { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { DestinationAutocomplete } from './destination-autocomplete';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { HandDrawnInput } from '@/components/ui/hand-drawn-input';
import { PromoChip } from '@/components/ui/promo-chip';
import { KanyeQuotes } from './kanye-quotes';

interface GenerateFormProps {
  onSubmit: (data: {
    destination: string;
    startDate: string;
    endDate: string;
    title?: string;
    generationMode?: 'standard' | 'advanced';
    activityDensity?: 'relaxed' | 'moderate' | 'packed';
  }) => Promise<void>;
  isLoading?: boolean;
  useStreaming?: boolean;
  onProgress?: (progress: { status: string; message: string; progress?: number }) => void;
}

export function GenerateForm({ onSubmit, isLoading, onProgress }: GenerateFormProps) {
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [title, setTitle] = useState('');
  const [generationMode, setGenerationMode] = useState<'standard' | 'advanced'>('standard');
  const [activityDensity, setActivityDensity] = useState<'relaxed' | 'moderate' | 'packed'>(
    'moderate'
  );
  const [error, setError] = useState('');
  const [realProgress, setRealProgress] = useState<{
    status: string;
    message: string;
    progress?: number;
  } | null>(null);

  useEffect(() => {
    if (realProgress && onProgress) onProgress(realProgress);
  }, [realProgress, onProgress]);

  // Pre-fill from landing/dashboard prompt if present
  useEffect(() => {
    try {
      const pending = sessionStorage.getItem('aspot:pending-prompt');
      if (pending && !title) {
        setTitle(pending);
        sessionStorage.removeItem('aspot:pending-prompt');
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!destination.trim()) return setError('Please enter a destination');
    if (!startDate || !endDate) return setError('Please select both dates');
    if (new Date(startDate) > new Date(endDate))
      return setError('End date must be after start date');

    try {
      await onSubmit({
        destination: destination.trim(),
        startDate,
        endDate,
        title: title.trim() || undefined,
        generationMode,
        activityDensity,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate itinerary');
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const tripDays =
    startDate && endDate
      ? Math.ceil(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
        ) + 1
      : 0;

  if (isLoading) {
    return (
      <div className="animate-fade-up mx-auto max-w-xl">
        <KanyeQuotes destination={destination} realProgress={realProgress} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl">
      <div className="animate-fade-up mb-8">
        <PromoChip>New itinerary</PromoChip>
        <h2 className="mt-5 font-heading text-5xl leading-[0.95] text-[color:var(--ink)] md:text-6xl">
          Where <span className="italic">to</span>?
        </h2>
      </div>

      <HandDrawnCard className="animate-fade-up p-7" style={{ animationDelay: '0.1s' }}>
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--ink-muted)]">
              Destination
            </label>
            <DestinationAutocomplete
              value={destination}
              onChange={setDestination}
              placeholder="Paris, Tokyo, Lisbon…"
            />
          </div>

          <HandDrawnInput
            label="Trip name (optional)"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Summer in Portugal"
            disabled={isLoading}
          />

          <div className="grid grid-cols-2 gap-4">
            <HandDrawnInput
              label="Start date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={today}
              disabled={isLoading}
            />
            <HandDrawnInput
              label="End date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || today}
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="mb-3 block text-sm font-medium text-[color:var(--ink-muted)]">
              Daily pace
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'relaxed', label: 'Relaxed', desc: '2-3 / day' },
                { value: 'moderate', label: 'Moderate', desc: '4-5 / day' },
                { value: 'packed', label: 'Packed', desc: '6-8 / day' },
              ].map((option) => (
                <SegmentedButton
                  key={option.value}
                  selected={activityDensity === option.value}
                  onClick={() =>
                    setActivityDensity(option.value as 'relaxed' | 'moderate' | 'packed')
                  }
                  disabled={isLoading}
                  label={option.label}
                  sublabel={option.desc}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="mb-3 block text-sm font-medium text-[color:var(--ink-muted)]">
              Generation mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <SegmentedButton
                selected={generationMode === 'standard'}
                onClick={() => setGenerationMode('standard')}
                disabled={isLoading}
                label="Standard"
                sublabel="~15-30 seconds"
              />
              <SegmentedButton
                selected={generationMode === 'advanced'}
                onClick={() => setGenerationMode('advanced')}
                disabled={isLoading}
                label="Deep research"
                sublabel="~10-15 minutes"
              />
            </div>
            <p className="mt-3 text-xs text-[color:var(--ink-soft)]">
              {generationMode === 'standard'
                ? 'Balanced web research for real locations, best for quick planning.'
                : 'Deeper multi-source research with quality iterations — slower, higher fidelity.'}
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          )}

          {tripDays > 5 && (
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--ink-muted)]">
              <span className="font-medium text-[color:var(--ink)]">Heads up: </span>
              Your {tripDays}-day trip may take a bit longer to generate
              {tripDays > 10
                ? generationMode === 'advanced'
                  ? ' (15-20 min)'
                  : ' (30-45s)'
                : generationMode === 'advanced'
                  ? ' (10-15 min)'
                  : ' (20-35s)'}
              .
            </div>
          )}

          <HandDrawnButton
            type="submit"
            disabled={isLoading}
            variant="primary"
            size="lg"
            className="w-full gap-2"
          >
            Generate itinerary
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </HandDrawnButton>
        </div>

        <p className="mt-4 text-center text-xs text-[color:var(--ink-soft)]">
          Personalized from your quiz preferences
        </p>
      </HandDrawnCard>
    </form>
  );
}

function SegmentedButton({
  selected,
  onClick,
  disabled,
  label,
  sublabel,
}: {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  sublabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border px-3 py-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
        selected
          ? 'border-[color:var(--ink)] bg-[color:var(--ink)] text-white'
          : 'border-[color:var(--border)] bg-white text-[color:var(--ink)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-soft)]'
      }`}
    >
      <div className="font-heading text-lg leading-none">{label}</div>
      <div
        className={`mt-1.5 text-xs ${selected ? 'text-white/75' : 'text-[color:var(--ink-muted)]'}`}
      >
        {sublabel}
      </div>
    </button>
  );
}
