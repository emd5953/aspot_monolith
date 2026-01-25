'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GenerateForm } from '@/components/itinerary/generate-form';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';

interface Itinerary {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
}

export default function ItineraryPage() {
  const router = useRouter();
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchItineraries();
  }, []);

  const fetchItineraries = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/itinerary/list');
      if (res.ok) {
        const data = await res.json();
        setItineraries(data.itineraries || []);
      }
    } catch (error) {
      console.error('Failed to fetch itineraries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async (data: {
    destination: string;
    startDate: string;
    endDate: string;
    title?: string;
    useAgenticMode?: boolean;
  }) => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/itinerary/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to generate');
      }

      const { itinerary } = await res.json();
      
      // Show success message before redirecting
      alert('✓ Itinerary created and saved! You can now view and edit it.');
      
      router.push(`/itinerary/${itinerary.id}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, itineraryId: string) => {
    e.stopPropagation(); // Prevent navigation when clicking delete
    
    if (!confirm('Are you sure you want to delete this itinerary? This action cannot be undone.')) return;

    try {
      const res = await fetch(`/api/itinerary/${itineraryId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete itinerary');
      }

      // Refresh the list
      fetchItineraries();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete itinerary');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const statusEmojis: Record<string, string> = {
    draft: '📝',
    active: '✈️',
    completed: '✅',
    archived: '📦',
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-post-it border-foreground',
    active: 'bg-secondary-accent/20 text-secondary-accent border-secondary-accent',
    completed: 'bg-accent/20 text-accent border-accent',
    archived: 'bg-muted border-foreground',
  };

  if (showForm) {
    return (
      <div className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-xl mx-auto">
          <HandDrawnButton
            onClick={() => setShowForm(false)}
            variant="secondary"
            size="sm"
            className="mb-6"
          >
            ← Back to itineraries
          </HandDrawnButton>
          <GenerateForm onSubmit={handleGenerate} isLoading={isGenerating} />
        </div>
      </div>
    );
  }

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
            onClick={() => router.push('/trips')}
            variant="secondary"
            size="sm"
          >
            👥 Trips
          </HandDrawnButton>
        </div>

        <HandDrawnCard decoration="tape" className="p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-heading text-foreground -rotate-1">
                ✈️ My Itineraries
              </h1>
              <p className="text-foreground/70 font-body text-lg mt-1">
                Your personalized travel plans
              </p>
            </div>
            <HandDrawnButton
              onClick={() => setShowForm(true)}
              variant="accent"
              size="md"
            >
              ➕ New Trip
            </HandDrawnButton>
          </div>
        </HandDrawnCard>

        {isLoading ? (
          <HandDrawnCard className="p-12 text-center">
            <div className="animate-spin h-12 w-12 border-4 border-accent border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-foreground/60 font-body">Loading your adventures...</p>
          </HandDrawnCard>
        ) : itineraries.length === 0 ? (
          <HandDrawnCard decoration="tack" className="p-12 text-center">
            <div className="text-6xl mb-4">🗺️</div>
            <h2 className="text-3xl font-heading text-foreground mb-2">No itineraries yet!</h2>
            <p className="text-foreground/70 font-body text-lg mb-6">
              Create your first AI-powered travel itinerary
            </p>
            <HandDrawnButton
              onClick={() => setShowForm(true)}
              variant="accent"
              size="lg"
            >
              ✨ Generate Itinerary
            </HandDrawnButton>
          </HandDrawnCard>
        ) : (
          <div className="grid gap-6">
            {itineraries.map((itinerary, index) => (
              <HandDrawnCard
                key={itinerary.id}
                className="p-6 cursor-pointer hover:shadow-hand transition-all hover:-rotate-1"
                rotation={index % 2 === 0 ? 0.5 : -0.5}
                onClick={() => router.push(`/itinerary/${itinerary.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-2xl font-heading text-foreground">{itinerary.title}</h3>
                    <p className="text-foreground/70 font-body mt-2">
                      📍 {itinerary.destination}
                    </p>
                    <p className="text-sm text-foreground/60 font-body mt-1">
                      📅 {formatDate(itinerary.startDate)} - {formatDate(itinerary.endDate)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-3 py-1 text-xs border-2 border-wobbly-sm font-body ${statusColors[itinerary.status]}`}>
                      {statusEmojis[itinerary.status]} {itinerary.status}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDelete(e, itinerary.id)}
                        className="text-red-500 hover:text-red-700 text-sm font-body px-2 py-1 border-2 border-red-500 hover:bg-red-50 transition-colors"
                        title="Delete itinerary"
                      >
                        🗑️
                      </button>
                      <span className="text-3xl">→</span>
                    </div>
                  </div>
                </div>
              </HandDrawnCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
