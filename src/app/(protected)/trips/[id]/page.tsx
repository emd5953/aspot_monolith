'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { InviteLink } from '@/components/trips/invite-link';
import { MemberList } from '@/components/trips/member-list';
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
  }, [id]);

  const fetchTrip = async () => {
    try {
      const res = await fetch(`/api/trips/${id}`);
      if (!res.ok) {
        throw new Error('Failed to load trip');
      }
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

      if (res.ok) {
        fetchTrip();
      }
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      const res = await fetch(`/api/trips/${id}/members/${userId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchTrip();
      }
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  };

  const handleRegenerateCode = async () => {
    try {
      const res = await fetch(`/api/trips/${id}/regenerate-code`, {
        method: 'POST',
      });

      if (res.ok) {
        fetchTrip();
      }
    } catch (err) {
      console.error('Failed to regenerate code:', err);
    }
  };

  const isOrganizer = trip?.members.some(
    m => m.userId === currentUserId && m.role === 'organizer'
  ) || false;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <HandDrawnCard className="p-12 text-center">
          <div className="animate-spin h-12 w-12 border-4 border-accent border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-foreground/60 font-body">Loading trip...</p>
        </HandDrawnCard>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <HandDrawnCard className="p-12 text-center max-w-md">
          <div className="text-6xl mb-4">😕</div>
          <p className="text-foreground font-body text-lg mb-6">{error || 'Trip not found'}</p>
          <HandDrawnButton
            onClick={() => router.push('/trips')}
            variant="accent"
          >
            ← Back to trips
          </HandDrawnButton>
        </HandDrawnCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <HandDrawnButton
          onClick={() => router.push('/trips')}
          variant="secondary"
          size="sm"
          className="mb-6"
        >
          ← Back to trips
        </HandDrawnButton>

        <HandDrawnCard decoration="tape" className="p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-heading text-foreground">{trip.name}</h1>
              <p className="text-foreground/70 font-body mt-2">
                👥 {trip.members.length} member{trip.members.length !== 1 ? 's' : ''}
              </p>
            </div>
            <HandDrawnButton
              onClick={() => router.push(`/itinerary/${trip.itineraryId}`)}
              variant="accent"
              size="sm"
            >
              View Itinerary
            </HandDrawnButton>
          </div>

          {isOrganizer && (
            <InviteLink
              inviteCode={trip.inviteCode}
              onRegenerate={handleRegenerateCode}
            />
          )}
        </HandDrawnCard>

        <HandDrawnCard decoration="tack" className="p-6">
          <MemberList
            members={trip.members}
            currentUserId={currentUserId}
            isOrganizer={isOrganizer}
            onUpdateRole={handleUpdateRole}
            onRemove={handleRemoveMember}
          />
        </HandDrawnCard>
      </div>
    </div>
  );
}
