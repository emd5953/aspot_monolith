'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { HandDrawnInput } from '@/components/ui/hand-drawn-input';
import { Search, MapPin, Calendar } from 'lucide-react';

interface Itinerary {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
}

export function ItinerarySearch() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [filteredItineraries, setFilteredItineraries] = useState<Itinerary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchItineraries();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredItineraries(itineraries.slice(0, 5)); // Show only first 5 when no search
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = itineraries.filter(
        (itinerary) =>
          itinerary.title.toLowerCase().includes(query) ||
          itinerary.destination.toLowerCase().includes(query) ||
          itinerary.status.toLowerCase().includes(query)
      );
      setFilteredItineraries(filtered);
    }
  }, [searchQuery, itineraries]);

  const fetchItineraries = async () => {
    try {
      const res = await fetch('/api/itinerary/list');
      if (res.ok) {
        const data = await res.json();
        setItineraries(data.itineraries || []);
        setFilteredItineraries((data.itineraries || []).slice(0, 5));
      }
    } catch (error) {
      console.error('Failed to fetch itineraries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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

  if (isLoading) {
    return (
      <HandDrawnCard decoration="tape" className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Search className="w-6 h-6 text-foreground" strokeWidth={2.5} />
          <h3 className="text-2xl font-heading text-foreground">Search Itineraries</h3>
        </div>
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full mx-auto"></div>
          <p className="text-foreground/60 font-body mt-4">Loading...</p>
        </div>
      </HandDrawnCard>
    );
  }

  return (
    <HandDrawnCard decoration="tape" className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Search className="w-6 h-6 text-foreground" strokeWidth={2.5} />
        <h3 className="text-2xl font-heading text-foreground">Search Itineraries</h3>
      </div>

      <div className="mb-6">
        <HandDrawnInput
          type="text"
          placeholder="Search by destination, title, or status..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
        />
      </div>

      {filteredItineraries.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-foreground/60 font-body">
            {searchQuery ? 'No itineraries found' : 'No itineraries yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItineraries.map((itinerary) => (
            <div
              key={itinerary.id}
              onClick={() => router.push(`/itinerary/${itinerary.id}`)}
              className="p-4 border-2 border-foreground border-wobbly-sm bg-card hover:bg-muted/50 cursor-pointer transition-all hover:shadow-hand hover:-rotate-1"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-heading text-foreground truncate">
                    {itinerary.title}
                  </h4>
                  <div className="flex items-center gap-2 text-sm text-foreground/70 font-body mt-1">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{itinerary.destination}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-foreground/60 font-body mt-1">
                    <Calendar className="w-3 h-3 flex-shrink-0" />
                    <span>
                      {formatDate(itinerary.startDate)} - {formatDate(itinerary.endDate)}
                    </span>
                  </div>
                </div>
                <span
                  className={`px-2 py-1 text-xs border-2 border-wobbly-sm font-body whitespace-nowrap ${statusColors[itinerary.status]}`}
                >
                  {statusEmojis[itinerary.status]} {itinerary.status}
                </span>
              </div>
            </div>
          ))}
          
          {!searchQuery && itineraries.length > 5 && (
            <button
              onClick={() => router.push('/itinerary')}
              className="w-full py-3 text-center text-accent font-body hover:underline"
            >
              View all {itineraries.length} itineraries →
            </button>
          )}
        </div>
      )}
    </HandDrawnCard>
  );
}
