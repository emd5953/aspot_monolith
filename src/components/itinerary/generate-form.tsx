'use client';

import { useState, useEffect } from 'react';
import { DestinationAutocomplete } from './destination-autocomplete';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { HandDrawnInput } from '@/components/ui/hand-drawn-input';
import { KanyeQuotes } from './kanye-quotes'; // TODO: Rename to LoadingProgress

interface GenerateFormProps {
  onSubmit: (data: {
    destination: string;
    startDate: string;
    endDate: string;
    title?: string;
    generationMode?: 'fast' | 'standard' | 'advanced';
    activityDensity?: 'relaxed' | 'moderate' | 'packed';
  }) => Promise<void>;
  isLoading?: boolean;
  useStreaming?: boolean; // Enable real-time progress updates
  onProgress?: (progress: { status: string; message: string; progress?: number }) => void;
}

export function GenerateForm({ onSubmit, isLoading, useStreaming, onProgress }: GenerateFormProps) {
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [title, setTitle] = useState('');
  const [generationMode, setGenerationMode] = useState<'fast' | 'standard' | 'advanced'>('standard'); // New: mode selection
  const [activityDensity, setActivityDensity] = useState<'relaxed' | 'moderate' | 'packed'>('moderate');
  const [error, setError] = useState('');
  const [realProgress, setRealProgress] = useState<{ status: string; message: string; progress?: number } | null>(null);

  // Update parent when progress changes
  useEffect(() => {
    if (realProgress && onProgress) {
      onProgress(realProgress);
    }
  }, [realProgress, onProgress]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!destination.trim()) {
      setError('Please enter a destination');
      return;
    }

    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('End date must be after start date');
      return;
    }

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
  
  // Calculate trip duration
  const tripDays = startDate && endDate 
    ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto">
        <KanyeQuotes destination={destination} realProgress={realProgress} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto">
      <HandDrawnCard decoration="tape" className="p-8">
        <h2 className="text-3xl font-heading text-foreground mb-6 -rotate-1">
          ✈️ Generate Your Itinerary
        </h2>

        <div className="space-y-6">
          <div>
            <label className="block text-foreground font-body text-lg mb-2">
              Where are you going? 🌍
            </label>
            <DestinationAutocomplete
              value={destination}
              onChange={setDestination}
              placeholder="e.g., Paris, Tokyo, New York..."
            />
          </div>

          <HandDrawnInput
            label="Trip name (optional) 📝"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Summer Vacation 2026"
            disabled={isLoading}
          />

          <div className="grid grid-cols-2 gap-4">
            <HandDrawnInput
              label="Start date 📅"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={today}
              disabled={isLoading}
            />
            <HandDrawnInput
              label="End date 📅"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || today}
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-foreground font-body text-lg mb-3">
              Activity Density 🎯
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'relaxed', emoji: '🌴', label: 'Relaxed', desc: '2-3 activities/day' },
                { value: 'moderate', emoji: '⚖️', label: 'Moderate', desc: '4-5 activities/day' },
                { value: 'packed', emoji: '⚡', label: 'Packed', desc: '6-8 activities/day' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setActivityDensity(option.value as 'relaxed' | 'moderate' | 'packed')}
                  disabled={isLoading}
                  className={`p-4 border-2 border-wobbly-sm font-body text-center transition-all ${
                    activityDensity === option.value
                      ? 'bg-accent text-white border-accent shadow-hand -rotate-1'
                      : 'bg-card text-foreground border-foreground hover:bg-muted hover:shadow-hand-sm'
                  }`}
                >
                  <div className="text-2xl mb-1">{option.emoji}</div>
                  <div className="font-heading text-sm">{option.label}</div>
                  <div className="text-xs opacity-80 mt-1">{option.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-foreground font-body text-lg mb-3">
              🎯 Generation Mode
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setGenerationMode('fast')}
                disabled={isLoading}
                className={`p-4 border-2 border-foreground transition-all ${
                  generationMode === 'fast'
                    ? 'bg-accent/20 border-accent shadow-hand-drawn'
                    : 'bg-card hover:bg-muted'
                }`}
              >
                <div className="text-left">
                  <div className="font-heading text-lg mb-1">⚡ Fast</div>
                  <div className="text-sm text-foreground/70 font-body">
                    AI knowledge only
                    <br />
                    <span className="text-xs">~5-10 seconds</span>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setGenerationMode('standard')}
                disabled={isLoading}
                className={`p-4 border-2 border-foreground transition-all ${
                  generationMode === 'standard'
                    ? 'bg-accent/20 border-accent shadow-hand-drawn'
                    : 'bg-card hover:bg-muted'
                }`}
              >
                <div className="text-left">
                  <div className="font-heading text-lg mb-1">🤖 Standard</div>
                  <div className="text-sm text-foreground/70 font-body">
                    Web research + AI
                    <br />
                    <span className="text-xs">~15-30 seconds</span>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setGenerationMode('advanced')}
                disabled={isLoading}
                className={`p-4 border-2 border-foreground transition-all ${
                  generationMode === 'advanced'
                    ? 'bg-secondary-accent/20 border-secondary-accent shadow-hand-drawn'
                    : 'bg-card hover:bg-muted'
                }`}
              >
                <div className="text-left">
                  <div className="font-heading text-lg mb-1">🔬 Advanced</div>
                  <div className="text-sm text-foreground/70 font-body">
                    Extensive research
                    <br />
                    <span className="text-xs">~10-15 minutes</span>
                  </div>
                </div>
              </button>
            </div>
            <p className="text-xs text-foreground/60 mt-2 font-body">
              {generationMode === 'fast' 
                ? '💡 Fast mode uses AI knowledge - quick but may suggest generic places'
                : generationMode === 'standard'
                ? '💡 Standard mode scrapes 1 web source for real locations - best balance of speed & quality'
                : '💡 Advanced mode scrapes multiple sources (Google, Reddit, TripAdvisor) with quality iterations - takes 10-15 min but highest quality'}
            </p>
          </div>

          {error && (
            <HandDrawnCard className="p-4 bg-accent/10 border-accent">
              <p className="text-sm text-accent font-body">⚠️ {error}</p>
            </HandDrawnCard>
          )}

          {tripDays > 5 && (
            <HandDrawnCard variant="post-it" className="p-4 bg-secondary-accent/10 border-secondary-accent">
              <p className="text-sm text-foreground font-body">
                ⏱️ <strong>Heads up!</strong> Your {tripDays}-day trip will take a bit longer to generate 
                {tripDays > 10 
                  ? (generationMode === 'advanced' ? ' (15-20 minutes)' : generationMode === 'standard' ? ' (30-45s)' : ' (15-25s)')
                  : (generationMode === 'advanced' ? ' (10-15 minutes)' : generationMode === 'standard' ? ' (20-35s)' : ' (10-15s)')
                } due to the extra planning needed. Worth the wait! ✨
              </p>
            </HandDrawnCard>
          )}

          <HandDrawnButton
            type="submit"
            disabled={isLoading}
            variant="accent"
            size="lg"
            className="w-full"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5 inline mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating magic...
              </>
            ) : (
              <>⚡ Generate Itinerary</>
            )}
          </HandDrawnButton>
        </div>

        <p className="text-xs text-foreground/60 text-center mt-4 font-body">
          ✨ AI will create a personalized itinerary based on your quiz preferences
        </p>
      </HandDrawnCard>
    </form>
  );
}
