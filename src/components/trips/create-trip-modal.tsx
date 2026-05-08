'use client';

import { useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';
import { HandDrawnInput } from '@/components/ui/hand-drawn-input';

interface CreateTripModalProps {
  itineraryId: string;
  itineraryTitle: string;
  onClose: () => void;
  onCreated: (tripId: string) => void;
}

export function CreateTripModal({
  itineraryId,
  itineraryTitle,
  onClose,
  onCreated,
}: CreateTripModalProps) {
  const [name, setName] = useState(`${itineraryTitle} — Group trip`);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, itineraryId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create trip');
      }

      const { trip } = await res.json();
      onCreated(trip.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create trip');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--ink)]/35 p-4 backdrop-blur-sm">
      <HandDrawnCard className="animate-fade-up w-full max-w-md p-7">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-[color:var(--ink-muted)]">
              New shared trip
            </p>
            <h2 className="font-heading text-3xl text-[color:var(--ink)]">
              Plan <span className="italic">together</span>.
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--ink-soft)] transition-all hover:border-[color:var(--border-strong)] hover:text-[color:var(--ink)] disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <p className="mb-5 text-sm text-[color:var(--ink-muted)]">
          Turn your itinerary into a collaborative trip that you can share with friends.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <HandDrawnInput
            label="Trip name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter a trip name"
            required
          />

          {error && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <HandDrawnButton
              type="button"
              onClick={onClose}
              variant="secondary"
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </HandDrawnButton>
            <HandDrawnButton
              type="submit"
              variant="primary"
              disabled={isLoading || !name.trim()}
              className="flex-1 gap-2"
            >
              {isLoading ? 'Creating…' : 'Create trip'}
              {!isLoading && <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />}
            </HandDrawnButton>
          </div>
        </form>
      </HandDrawnCard>
    </div>
  );
}
