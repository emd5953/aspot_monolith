'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ItineraryView } from '@/components/itinerary/itinerary-view';
import { RegenerateModal } from '@/components/itinerary/regenerate-modal';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ItemSource } from '@/lib/ai/provenance';

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
  source?: ItemSource;
  locationCoords?: { lat: number; lng: number };
}

interface Itinerary {
  id: string;
  title: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  status: string;
  plans: Activity[];
  importantNotes?: string[];
  budgetRange?: string;
}

export default function ItineraryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
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
        plans: it.plans ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async (options: { useAgenticMode: boolean; focusAreas?: string[] }) => {
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

  const handleReorderActivities = async (planIds: string[]) => {
    try {
      await fetch(`/api/itinerary/${id}/activities/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityIds: planIds }),
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

  if (isLoading) {
    return (
      <main className="mx-auto max-w-4xl px-5 pt-10 pb-24 md:px-6">
        <Card aria-busy className="animate-pulse">
          <div className="h-8 w-2/3 rounded bg-[color:var(--ink)]/8" />
          <div className="mt-4 h-4 w-1/3 rounded bg-[color:var(--ink)]/8" />
          <div className="mt-8 h-40 rounded bg-[color:var(--ink)]/5" />
        </Card>
      </main>
    );
  }

  if (error || !itinerary) {
    return (
      <main className="mx-auto max-w-xl px-5 pt-16 pb-24 text-center md:px-6">
        <p className="text-sm text-[color:var(--ink-muted)]">{error || 'Itinerary not found'}</p>
        <Button onClick={() => router.push('/itinerary')} className="mt-4">
          Back to moves
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-5 pt-6 pb-24 md:px-6">
      <button
        onClick={() => router.push('/itinerary')}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-[color:var(--ink-muted)] transition-colors hover:text-[color:var(--ink)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        Moves
      </button>

      <ItineraryView
        itinerary={itinerary}
        onDeleteActivity={handleDeleteActivity}
        onReorderActivities={handleReorderActivities}
        onRegenerate={isRegenerating ? undefined : () => setShowRegenerateModal(true)}
        onDelete={handleDelete}
        onStatusChange={handleStatusChange}
        onTitleChange={handleTitleChange}
      />

      <RegenerateModal
        isOpen={showRegenerateModal}
        onClose={() => setShowRegenerateModal(false)}
        onRegenerate={handleRegenerate}
      />



      {isRegenerating && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[color:var(--surface-page)]/90 p-4"
          role="status"
        >
          <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-[color:var(--ink)] border-t-transparent" />
          <p className="loading-dots text-sm font-medium text-[color:var(--ink-muted)]">
            Rebuilding the plan
          </p>
        </div>
      )}
    </main>
  );
}
