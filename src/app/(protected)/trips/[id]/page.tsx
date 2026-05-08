'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Users } from 'lucide-react';
import { InviteLink } from '@/components/trips/invite-link';
import { MemberList } from '@/components/trips/member-list';
import { AppNav } from '@/components/layout/app-nav';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';

interface Member {
  id: string;
  tripId: string;
  userId: string;
  role: 'organizer' | 'editor' | 'viewer';
  profile?: {
    displayName: string;
    avatarUrl?: string;
  };
}

interface Trip {
  id: string;
  name: string;
  itineraryId: string;
  inviteCode: string;
  members: Member[];
}

export default function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTrip();
    fetchCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchTrip = async () => {
    try {
      const res = await fetch(`/api/trips/${id}`);
      if (!res.ok) throw new Error('Failed to load trip');
      const data = await res.json();
      setTrip(data.trip);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentUserId(data.user?.id || '');
      }
    } catch (err) {
      console.error('Failed to get current user:', err);
    }
  };

  const handleUpdateRole = async (userId: string, role: 'editor' | 'viewer') => {
    try {
      const res = await fetch(`/api/trips/${id}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (res.ok) fetchTrip();
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      const res = await fetch(`/api/trips/${id}/members/${userId}`, { method: 'DELETE' });
      if (res.ok) fetchTrip();
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  };

  const handleRegenerateCode = async () => {
    try {
      const res = await fetch(`/api/trips/${id}/regenerate-code`, { method: 'POST' });
      if (res.ok) fetchTrip();
    } catch (err) {
      console.error('Failed to regenerate code:', err);
    }
  };

  const isOrganizer =
    trip?.members.some((m) => m.userId === currentUserId && m.role === 'organizer') ?? false;

  if (isLoading) {
    return (
      <div className="relative min-h-screen">
        <AppNav />
        <main className="relative mx-auto max-w-2xl px-6 pt-40 pb-24">
          <HandDrawnCard className="p-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--border)] border-t-[color:var(--accent)]" />
            <p className="mt-4 text-sm text-[color:var(--ink-muted)]">Loading trip</p>
          </HandDrawnCard>
        </main>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="relative min-h-screen">
        <AppNav />
        <main className="relative mx-auto max-w-xl px-6 pt-40 pb-24">
          <HandDrawnCard className="p-10 text-center">
            <p className="text-sm font-medium text-rose-600">Something went wrong</p>
            <h2 className="mt-3 font-heading text-3xl text-[color:var(--ink)]">
              {error || 'Trip not found'}
            </h2>
            <HandDrawnButton
              onClick={() => router.push('/trips')}
              variant="primary"
              size="md"
              className="mt-8"
            >
              Back to trips
            </HandDrawnButton>
          </HandDrawnCard>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <AppNav />

      <main className="relative mx-auto max-w-3xl px-6 pt-32 pb-24">
        <button
          onClick={() => router.push('/trips')}
          className="mb-6 inline-flex items-center gap-2 text-sm text-[color:var(--ink-muted)] transition-colors hover:text-[color:var(--ink)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
          Back to trips
        </button>

        {/* Header card */}
        <HandDrawnCard className="animate-fade-up mb-6 p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--ink-muted)]">
                <Users className="h-3.5 w-3.5" strokeWidth={2} />
                {trip.members.length} member{trip.members.length !== 1 ? 's' : ''}
              </p>
              <h1 className="mt-2 font-heading text-5xl leading-[1] text-[color:var(--ink)]">
                {trip.name}
              </h1>
            </div>
            <HandDrawnButton
              onClick={() => router.push(`/itinerary/${trip.itineraryId}`)}
              variant="primary"
              size="sm"
              className="gap-2"
            >
              View itinerary
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
            </HandDrawnButton>
          </div>

          {isOrganizer && (
            <div className="mt-6 border-t border-[color:var(--border)] pt-6">
              <InviteLink inviteCode={trip.inviteCode} onRegenerate={handleRegenerateCode} />
            </div>
          )}
        </HandDrawnCard>

        {/* Members */}
        <HandDrawnCard className="animate-fade-up p-7" style={{ animationDelay: '0.1s' }}>
          <p className="mb-5 text-sm font-medium text-[color:var(--ink-muted)]">Members</p>
          <MemberList
            members={trip.members}
            currentUserId={currentUserId}
            isOrganizer={isOrganizer}
            onUpdateRole={handleUpdateRole}
            onRemove={handleRemoveMember}
          />
        </HandDrawnCard>
      </main>
    </div>
  );
}
