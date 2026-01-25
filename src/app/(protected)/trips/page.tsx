'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';
import { HandDrawnInput } from '@/components/ui/hand-drawn-input';

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
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Navigation */}
        <div className="flex items-center gap-3 mb-6">
          <HandDrawnButton
            onClick={() => router.push('/dashboard')}
            variant="secondary"
            size="sm"
          >
            ← Dashboard
          </HandDrawnButton>
          <HandDrawnButton
            onClick={() => router.push('/itinerary')}
            variant="secondary"
            size="sm"
          >
            ✈️ Itineraries
          </HandDrawnButton>
        </div>

        <HandDrawnCard decoration="tape" className="p-6 mb-8">
          <h1 className="text-4xl font-heading text-foreground -rotate-1">
            👥 My Trips
          </h1>
          <p className="text-foreground/70 font-body text-lg mt-1">
            Collaborate with friends on your adventures
          </p>
        </HandDrawnCard>

        {/* Join Trip Form */}
        <HandDrawnCard decoration="tack" className="p-6 mb-6">
          <h2 className="text-2xl font-heading text-foreground mb-4">Join a Trip</h2>
          <form onSubmit={handleJoin} className="flex gap-3">
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
              variant="accent"
            >
              {isJoining ? 'Joining...' : 'Join'}
            </HandDrawnButton>
          </form>
          {joinError && (
            <p className="text-sm text-red-500 mt-2 font-body">{joinError}</p>
          )}
        </HandDrawnCard>

        {/* Trips List */}
        {isLoading ? (
          <HandDrawnCard className="p-12 text-center">
            <div className="animate-spin h-12 w-12 border-4 border-accent border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-foreground/60 font-body">Loading your trips...</p>
          </HandDrawnCard>
        ) : trips.length === 0 ? (
          <HandDrawnCard decoration="tape" className="p-12 text-center">
            <div className="text-6xl mb-4">👥</div>
            <h2 className="text-3xl font-heading text-foreground mb-2">No trips yet!</h2>
            <p className="text-foreground/70 font-body text-lg mb-6">
              Create a trip from an itinerary or join one with an invite code
            </p>
          </HandDrawnCard>
        ) : (
          <div className="grid gap-6">
            {trips.map((trip, index) => (
              <HandDrawnCard
                key={trip.id}
                className="p-6 cursor-pointer hover:shadow-hand transition-all hover:-rotate-1"
                rotation={index % 2 === 0 ? 0.5 : -0.5}
                onClick={() => router.push(`/trips/${trip.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-heading text-foreground">{trip.name}</h3>
                    <p className="text-foreground/70 font-body mt-2">
                      📅 Created {new Date(trip.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-3xl">→</span>
                </div>
              </HandDrawnCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
