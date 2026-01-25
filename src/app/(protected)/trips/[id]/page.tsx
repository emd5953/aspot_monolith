'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { InviteLink } from '@/components/trips/invite-link';
import { MemberList } from '@/components/trips/member-list';

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Trip not found'}</p>
          <button
            onClick={() => router.push('/trips')}
            className="text-blue-600 hover:underline"
          >
            Back to trips
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.push('/trips')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to trips
        </button>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{trip.name}</h1>
              <p className="text-gray-500 text-sm mt-1">
                {trip.members.length} member{trip.members.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => router.push(`/itinerary/${trip.itineraryId}`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              View Itinerary
            </button>
          </div>

          {isOrganizer && (
            <InviteLink
              inviteCode={trip.inviteCode}
              onRegenerate={handleRegenerateCode}
            />
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <MemberList
            members={trip.members}
            currentUserId={currentUserId}
            isOrganizer={isOrganizer}
            onUpdateRole={handleUpdateRole}
            onRemove={handleRemoveMember}
          />
        </div>
      </div>
    </div>
  );
}
