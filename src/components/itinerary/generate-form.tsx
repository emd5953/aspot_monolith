'use client';

import { useState } from 'react';
import { DestinationAutocomplete } from './destination-autocomplete';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { HandDrawnInput } from '@/components/ui/hand-drawn-input';

interface GenerateFormProps {
  onSubmit: (data: {
    destination: string;
    startDate: string;
    endDate: string;
    title?: string;
    useAgenticMode?: boolean;
  }) => Promise<void>;
  isLoading?: boolean;
}

export function GenerateForm({ onSubmit, isLoading }: GenerateFormProps) {
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [title, setTitle] = useState('');
  const [useAgenticMode, setUseAgenticMode] = useState(false);
  const [error, setError] = useState('');

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
        useAgenticMode,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate itinerary');
    }
  };

  const today = new Date().toISOString().split('T')[0];

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

          <HandDrawnCard variant="post-it" className="p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={useAgenticMode}
                onChange={(e) => setUseAgenticMode(e.target.checked)}
                disabled={isLoading}
                className="mt-1 w-5 h-5 text-accent border-2 border-foreground rounded focus:ring-accent"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-heading text-lg text-foreground">🤖 Agentic AI Mode</span>
                  <span className="text-xs bg-accent text-white px-2 py-0.5 border border-foreground border-wobbly-sm">
                    Premium
                  </span>
                </div>
                <p className="text-sm text-foreground/80 mt-1 font-body">
                  {useAgenticMode ? (
                    <>
                      <strong>Enabled:</strong> Multi-agent system with web research. 
                      Takes ~45-60s but higher quality! 🎯
                    </>
                  ) : (
                    <>
                      <strong>Disabled:</strong> Fast mode. Takes ~12s ⚡
                    </>
                  )}
                </p>
              </div>
            </label>
          </HandDrawnCard>

          {error && (
            <HandDrawnCard className="p-4 bg-accent/10 border-accent">
              <p className="text-sm text-accent font-body">⚠️ {error}</p>
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
