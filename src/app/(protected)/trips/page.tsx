'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Users, Calendar } from 'lucide-react';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';
import { HandDrawnInput } from '@/components/ui/hand-drawn-input';
import { PromoChip } from '@/components/ui/promo-chip';

interface Trip {
  id: string;
  name: string;
  itineraryId: string;
  inviteCode: string;
  createdAt: string;
}

export default function TripsPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      const res = await fetch('/api/trips');
      if (res.ok) {
        const data = await res.json();
        setTrips(data.trips || []);
      }
    } catch (error) {
      console.error('Failed to fetch trips:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    setIsJoining(true);

    try {
      const res = await fetch('/api/trips/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: joinCode }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to join');
      }

      const { tripId } = await res.json();
      router.push(`/trips/${tripId}`);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Failed to join trip');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <main className="relative mx-auto max-w-4xl px-6 pt-16 pb-24">
      <section className="animate-fade-up">
        <PromoChip>Shared trips</PromoChip>
        <h1 className="mt-5 font-heading text-6xl leading-[0.95] text-white md:text-7xl [text-shadow:0_2px_6px_rgba(10,30,60,0.6),0_8px_32px_rgba(10,30,60,0.5)]">
          My <span className="italic">trips</span>.
        </h1>
        <p className="mt-4 max-w-md text-base font-medium text-white [text-shadow:0_1px_4px_rgba(10,30,60,0.6),0_4px_18px_rgba(10,30,60,0.5)]">
          Plan together. Invite friends with a code, share suggestions, keep everyone on the
          same page.
        </p>
      </section>

      <section className="animate-fade-up mt-4" style={{ animationDelay: '0.1s' }}>
        <HandDrawnCard className="p-6">
          <p className="mb-4 text-sm font-medium text-[color:var(--ink-muted)]">Join a trip</p>
          <form onSubmit={handleJoin} className="flex flex-col gap-3 sm:flex-row">
            <HandDrawnInput
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter invite code"
              className="flex-1"
            />
            <HandDrawnButton
              type="submit"
              disabled={isJoining || !joinCode.trim()}
              variant="primary"
              className="gap-2"
            >
              {isJoining ? 'Joining…' : 'Join'}
              {!isJoining && <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />}
            </HandDrawnButton>
          </form>
          {joinError && <p className="mt-3 text-sm text-rose-600">{joinError}</p>}
        </HandDrawnCard>
      </section>

      <section className="animate-fade-up mt-4" style={{ animationDelay: '0.2s' }}>
        {isLoading ? (
          <HandDrawnCard className="p-14 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--border)] border-t-[color:var(--accent)]" />
            <p className="mt-4 text-sm text-[color:var(--ink-muted)]">Loading your trips</p>
          </HandDrawnCard>
        ) : trips.length === 0 ? (
          <HandDrawnCard className="p-14 text-center">
            <p className="text-sm font-medium text-[color:var(--ink-muted)]">Nothing shared yet</p>
            <h2 className="mt-3 font-heading text-4xl text-[color:var(--ink)]">
              Plan your first <span className="italic">group trip</span>.
            </h2>
            <p className="mx-auto mt-3 max-w-sm text-[color:var(--ink-muted)]">
              Create a trip from an existing itinerary, or join one with an invite code.
            </p>
          </HandDrawnCard>
        ) : (
          <div className="grid gap-4">
            {trips.map((trip) => (
              <HandDrawnCard
                key={trip.id}
                onClick={() => router.push(`/trips/${trip.id}`)}
                className="cursor-pointer p-6 hover:bg-white hover:shadow-[0_24px_48px_-22px_rgba(20,50,100,0.4)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--ink-muted)]">
                      <Users className="h-3.5 w-3.5" strokeWidth={2} />
                      Shared trip
                    </div>
                    <h3 className="mt-2 truncate font-heading text-3xl text-[color:var(--ink)]">
                      {trip.name}
                    </h3>
                    <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-[color:var(--ink-muted)]">
                      <Calendar className="h-3.5 w-3.5" strokeWidth={2} />
                      Created {new Date(trip.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--ink)]">
                    <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  </div>
                </div>
              </HandDrawnCard>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
