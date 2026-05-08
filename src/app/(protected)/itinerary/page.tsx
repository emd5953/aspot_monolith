'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Plus, Trash2, MapPin, Calendar } from 'lucide-react';
import { AppNav } from '@/components/layout/app-nav';
import { GenerateForm } from '@/components/itinerary/generate-form';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';
import { PromoChip } from '@/components/ui/promo-chip';

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
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-sm text-[color:var(--ink-muted)]">Loading…</div>
        </div>
      }
    >
      <ItineraryInner />
    </Suspense>
  );
}

function ItineraryInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchItineraries();
    if (searchParams.get('from') === 'prompt') {
      setShowForm(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      router.push(`/itinerary/${itinerary.id}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, itineraryId: string) => {
    e.stopPropagation();
    if (!confirm('Delete this itinerary? This action cannot be undone.')) return;

    try {
      const res = await fetch(`/api/itinerary/${itineraryId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete itinerary');
      fetchItineraries();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete itinerary');
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const statusStyles: Record<string, string> = {
    draft: 'bg-[color:var(--surface-soft)] text-[color:var(--ink-muted)] border-[color:var(--border)]',
    active: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    completed: 'bg-sky-50 text-sky-800 border-sky-200',
    archived: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  if (showForm) {
    return (
      <div className="relative min-h-screen">
        <AppNav />
        <main className="relative mx-auto max-w-2xl px-6 pt-32 pb-24">
          <button
            onClick={() => setShowForm(false)}
            className="mb-8 inline-flex items-center gap-2 text-sm text-[color:var(--ink-muted)] transition-colors hover:text-[color:var(--ink)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
            Back to itineraries
          </button>
          <GenerateForm onSubmit={handleGenerate} isLoading={isGenerating} />
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <AppNav />

      <main className="relative mx-auto max-w-5xl px-6 pt-32 pb-24">
        {/* Hero */}
        <section className="animate-fade-up">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <PromoChip>Your trips</PromoChip>
              <h1 className="mt-5 font-heading text-6xl leading-[0.95] text-[color:var(--ink)] md:text-7xl">
                My <span className="italic">itineraries</span>.
              </h1>
              <p className="mt-4 max-w-md text-base text-[color:var(--ink-muted)]">
                Every trip you&rsquo;ve planned, in one quiet place.
              </p>
            </div>
            <HandDrawnButton
              onClick={() => setShowForm(true)}
              variant="primary"
              size="md"
              className="gap-2 self-start md:self-end"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              New trip
            </HandDrawnButton>
          </div>
        </section>

        {/* List */}
        <section className="animate-fade-up mt-14" style={{ animationDelay: '0.1s' }}>
          {isLoading ? (
            <HandDrawnCard className="p-16 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--border)] border-t-[color:var(--accent)]" />
              <p className="mt-4 text-sm text-[color:var(--ink-muted)]">Loading your adventures</p>
            </HandDrawnCard>
          ) : itineraries.length === 0 ? (
            <HandDrawnCard className="p-16 text-center">
              <p className="text-sm font-medium text-[color:var(--ink-muted)]">Nothing yet</p>
              <h2 className="mt-3 font-heading text-4xl text-[color:var(--ink)]">
                Your first <span className="italic">trip</span> awaits.
              </h2>
              <p className="mx-auto mt-3 max-w-sm text-[color:var(--ink-muted)]">
                Describe a destination, a few dates, and a vibe — aSpot builds the rest.
              </p>
              <HandDrawnButton
                onClick={() => setShowForm(true)}
                variant="primary"
                size="md"
                className="mt-8 gap-2"
              >
                Generate itinerary
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
              </HandDrawnButton>
            </HandDrawnCard>
          ) : (
            <div className="grid gap-4">
              {itineraries.map((itinerary) => (
                <HandDrawnCard
                  key={itinerary.id}
                  onClick={() => router.push(`/itinerary/${itinerary.id}`)}
                  className="cursor-pointer p-6 hover:bg-white hover:shadow-[0_24px_48px_-22px_rgba(20,50,100,0.28)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusStyles[itinerary.status] ?? statusStyles.draft}`}
                        >
                          {itinerary.status}
                        </span>
                      </div>
                      <h3 className="mt-3 truncate font-heading text-3xl text-[color:var(--ink)]">
                        {itinerary.title}
                      </h3>
                      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-[color:var(--ink-muted)]">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
                          {itinerary.destination}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" strokeWidth={2} />
                          {formatDate(itinerary.startDate)} – {formatDate(itinerary.endDate)}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={(e) => handleDelete(e, itinerary.id)}
                        aria-label="Delete itinerary"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--ink-soft)] transition-all hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={2} />
                      </button>
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--ink)]">
                        <ArrowRight className="h-4 w-4" strokeWidth={2} />
                      </div>
                    </div>
                  </div>
                </HandDrawnCard>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
