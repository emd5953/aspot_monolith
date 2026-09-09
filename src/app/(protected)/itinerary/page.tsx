'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Itinerary {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
}

/**
 * One ACTIVE itinerary per user; everything else is view-only history.
 *
 * A list screen, so it reads as one: a small label instead of a 7xl serif
 * hero, and the plan card carries the weight. The "One live plan at a time"
 * subhead and the "View only" annotation explained a rule the layout already
 * shows.
 */
export default function ItineraryPage() {
  const router = useRouter();
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  // Anything not currently live belongs in history. Matching only 'archived'
  // made a 'completed' itinerary vanish from the UI entirely.
  const active = itineraries.find((it) => it.status === 'active' || it.status === 'draft');
  const history = itineraries.filter((it) => it.id !== active?.id);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

  return (
    <main className="mx-auto max-w-3xl px-5 pt-10 pb-24 md:px-6">
      <h1 className="text-sm font-medium text-[color:var(--ink-muted)]">Moves</h1>

      <section className="mt-4">
        {isLoading ? (
          <Card aria-busy className="animate-pulse">
            <div className="h-7 w-2/3 rounded bg-[color:var(--ink)]/8" />
            <div className="mt-4 h-4 w-1/3 rounded bg-[color:var(--ink)]/8" />
          </Card>
        ) : active ? (
          <Card
            interactive
            onClick={() => router.push(`/itinerary/${active.id}`)}
            className="flex items-center gap-4"
          >
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-2xl leading-tight break-words text-[color:var(--ink)] md:text-3xl">
                {active.title}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[color:var(--ink-muted)]">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <MapPin className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  <span className="truncate">{active.destination}</span>
                </span>
                <span className="shrink-0">
                  {formatDate(active.startDate)} – {formatDate(active.endDate)}
                </span>
              </div>
            </div>
            <ChevronRight
              className="h-5 w-5 shrink-0 text-[color:var(--ink-soft)]"
              strokeWidth={2}
              aria-hidden
            />
          </Card>
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm text-[color:var(--ink-muted)]">No moves yet.</p>
            <Button onClick={() => router.push('/dashboard')} className="mt-4">
              Plan tonight
            </Button>
          </div>
        )}
      </section>

      {!isLoading && history.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-medium text-[color:var(--ink-muted)]">Earlier</h2>
          <ul className="mt-3 divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]">
            {history.map((it) => (
              <li key={it.id}>
                <button
                  onClick={() => router.push(`/itinerary/${it.id}`)}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:text-[color:var(--ink)]"
                >
                  <span className="min-w-0 truncate text-sm text-[color:var(--ink)]">
                    {it.title}
                  </span>
                  <span className="shrink-0 text-xs text-[color:var(--ink-soft)]">
                    {formatDate(it.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
