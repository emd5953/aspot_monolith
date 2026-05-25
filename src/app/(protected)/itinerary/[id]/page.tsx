'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ItineraryView } from '@/components/itinerary/itinerary-view';
import { RegenerateModal } from '@/components/itinerary/regenerate-modal';
import { EditDayModal } from '@/components/itinerary/edit-day-modal';
import { KanyeQuotes } from '@/components/itinerary/kanye-quotes';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchItinerary = async () => {
    try {
      const res = await fetch(`/api/itinerary/${id}`);
      if (!res.ok) throw new Error('Failed to load itinerary');

      const data = await res.json();
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
      if (!res.ok) throw new Error('Failed to regenerate');
      await fetchItinerary();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to regenerate');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this itinerary? This action cannot be undone.'))
      return;

    try {
      const res = await fetch(`/api/itinerary/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete itinerary');
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
      if (res.ok) fetchItinerary();
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
      if (!res.ok) throw new Error('Failed to update status');
      if (itinerary) setItinerary({ ...itinerary, status });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleTitleChange = async (title: string) => {
    try {
      const res = await fetch(`/api/itinerary/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error('Failed to update title');
      if (itinerary) setItinerary({ ...itinerary, title });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update title');
    }
  };

  const handleEditDay = (dayId: string, dayNumber: number, activities: Activity[]) => {
    setEditingDay({ dayId, dayNumber, activities });
    setShowEditDayModal(true);
  };

  const handleEditDaySubmit = async (prompt: string) => {
    if (!editingDay) return;
    const res = await fetch(`/api/itinerary/${id}/days/${editingDay.dayId}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) throw new Error('Failed to regenerate day');
    await fetchItinerary();
    setShowEditDayModal(false);
    setEditingDay(null);
  };

  if (isLoading) {
    return (
      <main className="relative mx-auto max-w-4xl px-6 pt-32 pb-24">
        <HandDrawnCard className="p-16 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--border)] border-t-[color:var(--accent)]" />
          <p className="mt-4 text-sm text-[color:var(--ink-muted)]">Loading itinerary</p>
        </HandDrawnCard>
      </main>
    );
  }

  if (error || !itinerary) {
    return (
      <main className="relative mx-auto max-w-xl px-6 pt-32 pb-24">
        <HandDrawnCard className="p-10 text-center">
          <p className="text-sm font-medium text-rose-600">Something went wrong</p>
          <h2 className="mt-3 font-heading text-3xl text-[color:var(--ink)]">
            {error || 'Itinerary not found'}
          </h2>
          <HandDrawnButton
            onClick={() => router.push('/itinerary')}
            variant="primary"
            size="md"
            className="mt-8"
          >
            Back to itineraries
          </HandDrawnButton>
        </HandDrawnCard>
      </main>
    );
  }

  return (
    <main className="relative mx-auto max-w-4xl px-6 pt-32 pb-24">
      <button
        onClick={() => router.push('/itinerary')}
        className="mb-6 inline-flex items-center gap-2 text-sm text-white/85 transition-colors hover:text-white [text-shadow:0_1px_3px_rgba(10,30,60,0.5)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
        Back to itineraries
      </button>

      <ItineraryView
        itinerary={itinerary}
        onDeleteActivity={handleDeleteActivity}
        onReorderActivities={handleReorderActivities}
        onRegenerate={isRegenerating ? undefined : () => setShowRegenerateModal(true)}
        onDelete={handleDelete}
        onStatusChange={handleStatusChange}
        onEditDay={handleEditDay}
        onTitleChange={handleTitleChange}
      />

      <RegenerateModal
        isOpen={showRegenerateModal}
        onClose={() => setShowRegenerateModal(false)}
        onRegenerate={handleRegenerate}
      />

      <EditDayModal
        isOpen={showEditDayModal}
        dayNumber={editingDay?.dayNumber || 1}
        currentActivities={editingDay?.activities.map((a) => a.title) || []}
        onClose={() => {
          setShowEditDayModal(false);
          setEditingDay(null);
        }}
        onSubmit={handleEditDaySubmit}
      />

      {isRegenerating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--ink)]/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md">
            <KanyeQuotes />
          </div>
        </div>
      )}
    </main>
  );
}
