'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Plus, Trash2, MapPin, Calendar } from 'lucide-react';
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
  const router = useRouter();
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
    draft: 'bg-white/80 text-[color:var(--ink-muted)] border-white',
    active: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    completed: 'bg-sky-50 text-sky-800 border-sky-200',
    archived: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  return (
    <main className="relative mx-auto max-w-5xl px-4 pt-16 pb-24 md:px-6">
      <section className="animate-fade-up">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <PromoChip>Your trips</PromoChip>
            <h1 className="mt-5 font-heading text-4xl leading-[0.95] text-white sm:text-5xl md:text-7xl [text-shadow:0_2px_6px_rgba(10,30,60,0.6),0_8px_32px_rgba(10,30,60,0.5)]">
              My <span className="italic">itineraries</span>.
            </h1>
            <p className="mt-4 max-w-md text-base font-medium text-white [text-shadow:0_1px_4px_rgba(10,30,60,0.6),0_4px_18px_rgba(10,30,60,0.5)]">
              Every trip you&rsquo;ve planned, in one quiet place.
            </p>
          </div>
          <HandDrawnButton
            onClick={() => router.push('/dashboard')}
            variant="primary"
            size="md"
            className="gap-2 self-start md:self-end"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            New trip
          </HandDrawnButton>
        </div>
      </section>

      <section className="animate-fade-up mt-5" style={{ animationDelay: '0.1s' }}>
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
              onClick={() => router.push('/dashboard')}
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
                className="min-w-0 cursor-pointer p-5 hover:bg-white hover:shadow-[0_24px_48px_-22px_rgba(20,50,100,0.4)] md:p-6"
              >
                <div className="flex items-start justify-between gap-3 md:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusStyles[itinerary.status] ?? statusStyles.draft}`}
                      >
                        {itinerary.status}
                      </span>
                    </div>
                    {/* `truncate` sets whitespace-nowrap, whose min-content
                        width propagates up and forces the card wider than a
                        375px viewport. Wrapping keeps the card in bounds. */}
                    <h3 className="mt-3 font-heading text-2xl leading-tight break-words text-[color:var(--ink)] sm:text-3xl">
                      {itinerary.title}
                    </h3>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[color:var(--ink-muted)] md:gap-x-5">
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                        <span className="truncate">{itinerary.destination}</span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" strokeWidth={2} />
                        {formatDate(itinerary.startDate)} – {formatDate(itinerary.endDate)}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={(e) => handleDelete(e, itinerary.id)}
                      aria-label="Delete itinerary"
                      className="tap-target flex items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--ink-soft)] transition-all hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 md:h-9 md:w-9 md:min-h-0 md:min-w-0"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2} />
                    </button>
                    <div className="hidden h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--ink)] md:flex">
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
  );
}
