'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">My Trips</h1>
          <Link
            href="/itinerary"
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            Create from itinerary
          </Link>
        </div>

        {/* Join Trip Form */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Join a Trip</h2>
          <form onSubmit={handleJoin} className="flex gap-3">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter invite code"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={isJoining || !joinCode.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isJoining ? 'Joining...' : 'Join'}
            </button>
          </form>
          {joinError && (
            <p className="text-sm text-red-600 mt-2">{joinError}</p>
          )}
        </div>

        {/* Trips List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : trips.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No trips yet</h2>
            <p className="text-gray-500 mb-6">
              Create a trip from an itinerary or join one with an invite code
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {trips.map((trip) => (
              <div
                key={trip.id}
                onClick={() => router.push(`/trips/${trip.id}`)}
                className="bg-white rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md transition-shadow"
              >
                <h3 className="font-semibold text-gray-900">{trip.name}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Created {new Date(trip.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
