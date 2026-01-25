'use client';

import Link from 'next/link';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { Search, ArrowRight } from 'lucide-react';

export function ItinerarySearch() {
  return (
    <Link href="/itinerary">
      <HandDrawnCard decoration="tape" className="p-8 cursor-pointer hover:shadow-hand transition-all hover:-rotate-1 border-4 border-foreground">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 border-wobbly-sm border-[3px] border-foreground flex items-center justify-center bg-accent/20">
              <Search className="w-6 h-6 text-foreground" strokeWidth={2.5} />
            </div>
            <h3 className="text-3xl font-heading text-foreground">Generate New Itinerary</h3>
          </div>
          <ArrowRight className="w-8 h-8 text-accent" strokeWidth={3} />
        </div>
        <p className="text-foreground/70 font-body text-lg ml-16">
          Click here to create your personalized travel plan
        </p>
      </HandDrawnCard>
    </Link>
  );
}
