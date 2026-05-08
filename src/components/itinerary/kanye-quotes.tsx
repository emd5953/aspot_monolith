'use client';

import { useState, useEffect } from 'react';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';

const PROGRESS_STEPS = [
  'Researching top attractions and hidden gems',
  'Finding the best local restaurants',
  'Mapping optimal routes and neighborhoods',
  'Checking opening hours and availability',
  'Optimizing your daily schedule',
  'Personalizing based on your preferences',
];

const DESTINATION_FACTS: Record<string, string[]> = {
  default: [
    'Every destination has its own story to tell',
    'The best adventures often come from unexpected discoveries',
    'Local experiences create the most memorable moments',
    'Immersing yourself in local culture enriches any journey',
    'Food is the universal language of travel',
    'The best photos are the memories you make along the way',
  ],
  paris: [
    'The Eiffel Tower was only meant to stand for 20 years',
    'Paris has only one stop sign in the entire city',
    'The croissant was actually invented in Austria, not France',
    "The Louvre is the world's largest art museum with 380,000 objects",
    'There are 20,000 light bulbs on the Eiffel Tower',
  ],
  london: [
    'London has been a major settlement for over 2,000 years',
    'London has over 3,000 pubs, many centuries old',
    "The London Underground is the world's oldest metro system (1863)",
    'Buckingham Palace has 775 rooms and 78 bathrooms',
    'Tower Bridge opens about 800 times a year',
  ],
  rome: [
    'Rome has more fountains than any other city in the world (2,000+)',
    'Romans have been making pasta for over 2,000 years',
    'The Colosseum could hold up to 80,000 spectators',
    "Vatican City, within Rome, is the world's smallest country",
    'Tourists throw €3,000 into the Trevi Fountain daily',
  ],
  barcelona: [
    'Sagrada Familia has been under construction since 1882',
    'Barcelona has 9 UNESCO World Heritage Sites',
    'The city has 4.5km of beaches within city limits',
    "FC Barcelona's Camp Nou is Europe's largest stadium",
  ],
  amsterdam: [
    'Amsterdam has more bicycles than residents (880,000 bikes)',
    'Amsterdam has 165 canals and 1,281 bridges',
    'There are 2,500 houseboats in Amsterdam',
  ],
  berlin: [
    'The Berlin Wall stood for 28 years (1961-1989)',
    'Berlin has more museums than rainy days (175+ museums)',
    'Berlin is 9 times larger than Paris',
  ],
  tokyo: [
    "Tokyo is the world's most populous metropolitan area (37M+)",
    'Tokyo has more Michelin-starred restaurants than any other city',
    'Shibuya Crossing sees up to 3,000 people cross at once',
    'There are over 160,000 restaurants in Tokyo',
  ],
  bangkok: [
    "Bangkok's full ceremonial name has 169 characters",
    'The city has over 400 Buddhist temples',
    'Bangkok was once called the Venice of the East',
  ],
  singapore: [
    "Marina Bay Sands has the world's largest rooftop infinity pool",
    'The city has over 2 million trees',
    'Singapore has 4 official languages',
  ],
  seoul: [
    'Seoul has 5 UNESCO World Heritage Sites',
    'Seoul Metro is one of the busiest in the world (8M+ daily riders)',
  ],
  dubai: [
    "Burj Khalifa is the world's tallest building at 828m",
    "Dubai Metro is the world's longest driverless metro",
  ],
  'new york': [
    'The Statue of Liberty was a gift from France in 1886',
    'Central Park is larger than Monaco (341 hectares)',
    'NYC subway runs 24/7, one of few in the world',
    'New Yorkers consume 200 million pounds of pizza annually',
  ],
  'los angeles': [
    'Hollywood sign originally said "Hollywoodland"',
    'LA has 75 miles of coastline',
    'LA has sunshine 284 days a year',
  ],
  'san francisco': [
    'The Golden Gate Bridge is 2.7km long',
    'Cable cars are the only moving National Historic Landmark',
    'San Francisco has 43 hills',
  ],
};

interface KanyeQuotesProps {
  destination?: string;
  realProgress?: { status: string; message: string; progress?: number } | null;
}

export function KanyeQuotes({ destination, realProgress }: KanyeQuotesProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [currentFact, setCurrentFact] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);

  const getFacts = (dest?: string): string[] => {
    if (!dest) return DESTINATION_FACTS.default;
    const normalized = dest.toLowerCase().trim();
    const cleaned = normalized
      .replace(/\b(city|state|province|region|area)\b/g, '')
      .replace(/[,.-]/g, ' ')
      .trim();

    if (DESTINATION_FACTS[normalized]) return DESTINATION_FACTS[normalized];
    if (DESTINATION_FACTS[cleaned]) return DESTINATION_FACTS[cleaned];

    for (const key in DESTINATION_FACTS) {
      if (key === 'default') continue;
      if (normalized.includes(key) || key.includes(cleaned)) {
        return DESTINATION_FACTS[key];
      }
    }
    return DESTINATION_FACTS.default;
  };

  useEffect(() => {
    const facts = getFacts(destination);
    setCurrentFact(facts[Math.floor(Math.random() * facts.length)]);

    let stepInterval: NodeJS.Timeout | undefined;
    if (!realProgress) {
      stepInterval = setInterval(() => {
        setCurrentStep((prev) => (prev + 1) % PROGRESS_STEPS.length);
      }, 8000);
    }

    const factInterval = setInterval(() => {
      setCurrentFact(facts[Math.floor(Math.random() * facts.length)]);
    }, 12000);

    const timeInterval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => {
      if (stepInterval) clearInterval(stepInterval);
      clearInterval(factInterval);
      clearInterval(timeInterval);
    };
  }, [destination, realProgress]);

  const statusText = realProgress ? realProgress.message : PROGRESS_STEPS[currentStep];

  return (
    <HandDrawnCard className="p-8 text-center">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[color:var(--border)] border-t-[color:var(--accent)]" />

      <p className="mt-5 text-sm font-medium text-[color:var(--ink-muted)]">
        Building your itinerary
      </p>

      <div className="mt-5 flex animate-pulse items-center justify-center gap-2 text-sm text-[color:var(--ink)]">
        <span>{statusText}</span>
      </div>

      {realProgress?.progress !== undefined && (
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-[color:var(--surface-soft)]">
          <div
            className="h-full bg-[color:var(--accent)] transition-[width] duration-500 ease-out"
            style={{ width: `${realProgress.progress}%` }}
          />
        </div>
      )}

      {elapsedTime > 50 && elapsedTime <= 90 && (
        <p className="mt-6 animate-pulse text-xs text-[color:var(--ink-muted)]">Almost there.</p>
      )}
      {elapsedTime > 90 && elapsedTime <= 150 && (
        <p className="mt-6 animate-pulse text-xs text-[color:var(--ink-muted)]">
          Still working on it.
        </p>
      )}
      {elapsedTime > 150 && (
        <p className="mt-6 animate-pulse text-xs text-[color:var(--ink-muted)]">
          Wrapping up the last few details.
        </p>
      )}

      <div className="mt-8 border-t border-[color:var(--border)] pt-6">
        <p className="mb-3 text-xs font-medium text-[color:var(--ink-soft)]">
          {destination ? `About ${destination}` : 'Travel note'}
        </p>
        <p className="font-heading text-xl italic leading-snug text-[color:var(--ink)] transition-all duration-500">
          {currentFact}
        </p>
      </div>
    </HandDrawnCard>
  );
}
