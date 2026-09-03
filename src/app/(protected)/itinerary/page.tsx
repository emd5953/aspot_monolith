'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Plus, MapPin, Calendar, Clock3 } from 'lucide-react';
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

/** One ACTIVE itinerary per user; everything else is view-only history. */
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

  const active = itineraries.find((it) => it.status === 'active' || it.status === 'draft');
  const history = itineraries.filter((it) => it.status === 'archived');

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <main className="relative mx-auto max-w-5xl px-4 pt-16 pb-24 md:px-6">
      <section className="animate-fade-up">
        <PromoChip>Your trips</PromoChip>
        <h1 className="mt-5 font-heading text-4xl leading-[0.95] text-white sm:text-5xl md:text-7xl [text-shadow:0_2px_6px_rgba(10,30,60,0.6),0_8px_32px_rgba(10,30,60,0.5)]">
          Your move for tonight.
        </h1>
        <p className="mt-4 max-w-md text-base font-medium text-white [text-shadow:0_1px_4px_rgba(10,30,60,0.6),0_4px_18px_rgba(10,30,60,0.5)]">
          One live plan at a time — the old ones keep quietly below.
        </p>
      </section>

      {/* The one active itinerary */}
      <section className="animate-fade-up mt-10" style={{ animationDelay: '0.1s' }}>
        {isLoading ? (
          <HandDrawnCard className="p-16 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--border)] border-t-[color:var(--accent)]" />
            <p className="mt-4 text-sm text-[color:var(--ink-muted)]">Fetching the move</p>
          </HandDrawnCard>
        ) : active ? (
          <HandDrawnCard
            onClick={() => router.push(`/itinerary/${active.id}`)}
            className="min-w-0 cursor-pointer p-7 hover:bg-white hover:shadow-[0_24px_48px_-22px_rgba(20,50,100,0.4)] md:p-10"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium capitalize text-emerald-800">
                {active.status}
              </span>
            </div>
            {/* `truncate` sets whitespace-nowrap, whose min-content width
                propagates up and forces the card wider than a 375px viewport.
                Wrapping keeps the card in bounds. */}
            <h2 className="mt-4 font-heading text-4xl leading-[0.95] break-words text-[color:var(--ink)] sm:text-5xl md:text-6xl">
              {active.title}
            </h2>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-[color:var(--ink-muted)] md:text-base">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0" strokeWidth={2} />
                <span className="truncate">{active.destination}</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1.5">
                <Calendar className="h-4 w-4" strokeWidth={2} />
                {formatDate(active.startDate)} – {formatDate(active.endDate)}
              </span>
            </div>
            <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[color:var(--accent)]">
              Open the plan
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </div>
          </HandDrawnCard>
        ) : (
          <HandDrawnCard className="p-16 text-center">
            <p className="text-sm font-medium text-[color:var(--ink-muted)]">No moves yet — say the word.</p>
            <HandDrawnButton
              onClick={() => router.push('/dashboard')}
              variant="primary"
              size="md"
              className="mt-8 gap-2"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Plan tonight
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </HandDrawnButton>
          </HandDrawnCard>
        )}
      </section>

      {/* Old moves — view-only history */}
      {!isLoading && history.length > 0 && (
        <section className="animate-fade-up mt-14" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-baseline gap-3">
            <h2 className="font-heading text-2xl text-white [text-shadow:0_2px_6px_rgba(10,30,60,0.5)]">
              Old moves
            </h2>
            <span className="text-xs text-white/70 [text-shadow:0_1px_4px_rgba(10,30,60,0.5)]">
              View only
            </span>
          </div>
          <div className="mt-4 grid gap-2">
            {history.map((it) => (
              <button
                key={it.id}
                onClick={() => router.push(`/itinerary/${it.id}`)}
                className="group flex w-full items-center justify-between gap-3 rounded-xl border border-[color:var(--border)]/60 bg-white/50 px-4 py-2.5 text-left backdrop-blur-sm transition-all hover:bg-white/80"
              >
                <span className="min-w-0 truncate text-sm text-[color:var(--ink-soft)] group-hover:text-[color:var(--ink)]">
                  {it.title}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-[color:var(--ink-soft)]/70">
                  <Clock3 className="h-3 w-3" strokeWidth={2} />
                  {formatDate(it.createdAt)}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}