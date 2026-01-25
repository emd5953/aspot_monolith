'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ItineraryView } from '@/components/itinerary/itinerary-view';
import { RegenerateModal } from '@/components/itinerary/regenerate-modal';
import { EditDayModal } from '@/components/itinerary/edit-day-modal';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';

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
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [showEditDayModal, setShowEditDayModal] = useState(false);
  const [editingDay, setEditingDay] = useState<{
    dayId: string;
    dayNumber: number;
    activities: Activity[];
  } | null>(null);
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

  const handleRegenerate = async (options: {
    useAgenticMode: boolean;
    focusAreas?: string[];
  }) => {
    setIsRegenerating(true);
    setShowRegenerateModal(false);
    try {
      const res = await fetch(`/api/itinerary/${id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (!res.ok) {
        throw new Error('Failed to regenerate');
      }

      // Regenerate updates the same itinerary, so reload the data
      await fetchItinerary();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to regenerate');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this itinerary? This action cannot be undone.')) return;

    try {
      const res = await fetch(`/api/itinerary/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete itinerary');
      }

      router.push('/itinerary');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete itinerary');
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (!confirm('Delete this activity?')) return;

    try {
      const res = await fetch(`/api/itinerary/${id}/activities/${activityId}`, {
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
      await fetch(`/api/itinerary/${id}/activities/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayId, activityIds }),
      });
      fetchItinerary();
    } catch (err) {
      console.error('Failed to reorder:', err);
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      const res = await fetch(`/api/itinerary/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        throw new Error('Failed to update status');
      }

      // Update local state
      if (itinerary) {
        setItinerary({ ...itinerary, status });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleEditDay = (dayId: string, dayNumber: number, activities: Activity[]) => {
    setEditingDay({ dayId, dayNumber, activities });
    setShowEditDayModal(true);
  };

  const handleEditDaySubmit = async (prompt: string) => {
    if (!editingDay) return;

    try {
      const res = await fetch(`/api/itinerary/${id}/days/${editingDay.dayId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        throw new Error('Failed to regenerate day');
      }

      // Reload the itinerary to show updated activities
      await fetchItinerary();
      setShowEditDayModal(false);
      setEditingDay(null);
    } catch (err) {
      throw err; // Let the modal handle the error
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
        {/* Navigation Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push('/itinerary')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to itineraries
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border-2 border-gray-300 hover:border-gray-400 rounded transition-colors"
            >
              🏠 Dashboard
            </button>
            <button
              onClick={() => router.push('/trips')}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border-2 border-gray-300 hover:border-gray-400 rounded transition-colors"
            >
              👥 Trips
            </button>
          </div>
        </div>

        <ItineraryView
          itinerary={itinerary}
          onDeleteActivity={handleDeleteActivity}
          onReorderActivities={handleReorderActivities}
          onRegenerate={isRegenerating ? undefined : () => setShowRegenerateModal(true)}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
          onEditDay={handleEditDay}
        />

        <RegenerateModal
          isOpen={showRegenerateModal}
          onClose={() => setShowRegenerateModal(false)}
          onRegenerate={handleRegenerate}
        />

        <EditDayModal
          isOpen={showEditDayModal}
          dayNumber={editingDay?.dayNumber || 1}
          currentActivities={editingDay?.activities.map(a => a.title) || []}
          onClose={() => {
            setShowEditDayModal(false);
            setEditingDay(null);
          }}
          onSubmit={handleEditDaySubmit}
        />

        {isRegenerating && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <HandDrawnCard decoration="tape" className="p-8 max-w-md mx-4 text-center">
              <div className="animate-spin h-12 w-12 border-4 border-accent border-t-transparent rounded-full mx-auto mb-4"></div>
              <h3 className="text-2xl font-heading text-foreground mb-2">🔄 Regenerating Itinerary</h3>
              <p className="text-foreground/70 font-body">Creating fresh recommendations...</p>
              <p className="text-sm text-foreground/60 font-body mt-2">
                This may take 10-70 seconds depending on mode ⏱️
              </p>
              <p className="text-xs text-foreground/50 font-body mt-3">
                💡 Tip: Use Fast Mode for quicker results (~5s)
              </p>
            </HandDrawnCard>
          </div>
        )}
      </div>
    </div>
  );
}
