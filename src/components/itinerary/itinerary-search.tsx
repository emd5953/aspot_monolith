'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { PromptInput } from '@/components/ui/prompt-input';

interface ItinerarySearchProps {
  /**
   * `default`: white frosted pill on a light page background
   * `light`: frosty on-photo pill for hero sections over a video or photo
   */
  tone?: 'default' | 'light';
}

/**
 * Prompt-style entry point on the dashboard. Stashes the typed idea in
 * sessionStorage so /itinerary can pre-fill the generate form.
 */
export function ItinerarySearch({ tone = 'default' }: ItinerarySearchProps) {
  const router = useRouter();
  const [value, setValue] = useState('');

  const handleRouted = (typed: string) => {
    try {
      sessionStorage.setItem('aspot:pending-prompt', typed);
    } catch {
      /* ignore unavailable sessionStorage */
    }
    router.push('/itinerary?from=prompt');
  };

  if (tone === 'light') {
    const handleSubmit = (e: FormEvent) => {
      e.preventDefault();
      const trimmed = value.trim();
      if (!trimmed) return;
      handleRouted(trimmed);
    };

    return (
      <form
        onSubmit={handleSubmit}
        className="group mx-auto flex w-full max-w-xl items-center gap-2 rounded-full bg-white/85 px-2 py-2 pl-6 shadow-[0_24px_60px_-20px_rgba(10,25,55,0.5)] backdrop-blur-md transition-all focus-within:bg-white/95"
      >
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="A long weekend in Tokyo, big on food and small museums…"
          aria-label="Describe your trip"
          className="flex-1 bg-transparent py-2.5 text-base text-slate-800 placeholder:text-slate-500/70 outline-none"
        />
        <button
          type="submit"
          aria-label="Plan this trip"
          disabled={!value.trim()}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-slate-900 px-5 text-sm font-medium text-white transition-all hover:-translate-y-[1px] hover:bg-slate-800 disabled:opacity-50 disabled:hover:translate-y-0"
        >
          Plan it
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <PromptInput
        placeholder="A long weekend in Tokyo, big on food and small museums…"
        onSubmit={handleRouted}
        submitLabel="Plan it"
      />
      <p className="text-center text-sm text-[color:var(--ink-muted)]">
        Describe a trip. We&rsquo;ll build the plan.
      </p>
    </div>
  );
}
