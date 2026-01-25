'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ItineraryView } from '@/components/itinerary/itinerary-view';

interface Activity {
  id: string;
  title: string;
  description: string;
  locationName?: string;
  startTime?: string;
  endTime?: string;
  category: string;
  estimatedCost?: number;
  sortOrder: number;
  notes?: string;
}

interface Day {
  id: string;
  dayNumber: number;
  date: Date;
  notes?: string;
  activities: Activity[];
}

interface Itinerary {
  id: string;
  title: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  status: string;
  days: Day[];
}

export default function ItineraryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchItinerary();
  }, [id]);

  const fetchItinerary = async () => {
    try {
      const res = await fetch(`/api/itinerary/${id}`);
      if (!res.ok) {
        throw new Error('Failed to load itinerary');
      }
      const data = await res.json();
      
      // Convert date strings to Date objects
      const it = data.itinerary;
      setItinerary({
        ...it,
        startDate: new Date(it.startDate),
        endDate: new Date(it.endDate),
        days: it.days.map((d: { date: string; activities: Activity[] }) => ({
          ...d,
          date: new Date(d.date),
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!confirm('This will create a new version of your itinerary. Continue?')) return;

    try {
      const res = await fetch(`/api/itinerary/${id}/regenerate`, {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error('Failed to regenerate');
      }

      const { itinerary: newItinerary } = await res.json();
      router.push(`/itinerary/${newItinerary.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to regenerate');
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (!confirm('Delete this activity?')) return;

    try {
      const res = await fetch(`/api/activity/${activityId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchItinerary();
      }
    } catch (err) {
      console.error('Failed to delete activity:', err);
    }
  };

  const handleReorderActivities = async (dayId: string, activityIds: string[]) => {
    try {
      await fetch(`/api/day/${dayId}/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityIds }),
      });
      fetchItinerary();
    } catch (err) {
      console.error('Failed to reorder:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading itinerary...</p>
        </div>
      </div>
    );
  }

  if (error || !itinerary) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Itinerary not found'}</p>
          <button
            onClick={() => router.push('/itinerary')}
            className="text-blue-600 hover:underline"
          >
            Back to itineraries
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push('/itinerary')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to itineraries
        </button>

        <ItineraryView
          itinerary={itinerary}
          onDeleteActivity={handleDeleteActivity}
          onReorderActivities={handleReorderActivities}
          onRegenerate={handleRegenerate}
        />
      </div>
    </div>
  );
}
