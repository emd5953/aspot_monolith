'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { PromptInput } from '@/components/ui/prompt-input';
import { KanyeQuotes } from '@/components/itinerary/kanye-quotes';

interface ItinerarySearchProps {
  /**
   * `default`: white frosted pill on a light page background
   * `light`: frosty on-photo pill for hero sections over a video or photo
   */
  tone?: 'default' | 'light';
}

/**
 * One-shot itinerary generator. User types a natural-language trip description,
 * hits "Plan it", and we call the generate API directly — no intermediate form.
 * The API parses the prompt (destination, dates, pace) and generates.
 * While generating, a full-screen KanyeQuotes overlay keeps the user entertained.
 */
export function ItinerarySearch({ tone = 'default' }: ItinerarySearchProps) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Keep the typed prompt around for the loading overlay so we can show a
  // guess at the destination while generation runs.
  const [submittedPrompt, setSubmittedPrompt] = useState('');

  const handleGenerate = async (prompt: string) => {
    setIsGenerating(true);
    setSubmittedPrompt(prompt);
    setError(null);

    try {
      const res = await fetch('/api/itinerary/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate');
      }

      const { itinerary } = await res.json();
      router.push(`/itinerary/${itinerary.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsGenerating(false);
    }
  };

  return (
    <>
      {tone === 'light' ? (
        <LightPill
          value={value}
          setValue={setValue}
          onSubmit={handleGenerate}
          isGenerating={isGenerating}
          error={error}
        />
      ) : (
        <DefaultInput
          onSubmit={handleGenerate}
          isGenerating={isGenerating}
          error={error}
        />
      )}

      {/* Full-screen loading overlay while the itinerary is generating */}
      {isGenerating && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[color:var(--ink)]/50 p-4 backdrop-blur-md">
          <div className="w-full max-w-md">
            {/* Don't pass destination — the prompt flow doesn't know the parsed
                city yet, and showing the raw prompt looks weird. The component
                handles undefined gracefully with default fun facts. */}
            <KanyeQuotes />
          </div>
        </div>
      )}
    </>
  );
}

function LightPill({
  value,
  setValue,
  onSubmit,
  isGenerating,
  error,
}: {
  value: string;
  setValue: (v: string) => void;
  onSubmit: (prompt: string) => void;
  isGenerating: boolean;
  error: string | null;
}) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || isGenerating) return;
    onSubmit(trimmed);
  };

  return (
    <div className="w-full">
      <form
        onSubmit={handleSubmit}
        className="group mx-auto flex w-full max-w-xl items-center gap-2 rounded-full bg-white/85 px-2 py-2 pl-6 shadow-[0_24px_60px_-20px_rgba(10,25,55,0.5)] backdrop-blur-md transition-all focus-within:bg-white/95"
      >
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="2 nights in NYC, big on food…"
          aria-label="Describe your trip"
          disabled={isGenerating}
          className="flex-1 bg-transparent py-2.5 text-base text-slate-800 placeholder:text-slate-500/70 outline-none disabled:opacity-70"
        />
        <button
          type="submit"
          aria-label="Generate itinerary"
          disabled={!value.trim() || isGenerating}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-slate-900 px-5 text-sm font-medium text-white transition-all hover:-translate-y-[1px] hover:bg-slate-800 disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {isGenerating ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <>
              Plan it
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </>
          )}
        </button>
      </form>
      {error && (
        <p className="mt-3 text-center text-sm font-medium text-white [text-shadow:0_1px_3px_rgba(10,30,60,0.6)]">
          {error}
        </p>
      )}
    </div>
  );
}

function DefaultInput({
  onSubmit,
  isGenerating,
  error,
}: {
  onSubmit: (prompt: string) => void;
  isGenerating: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      <PromptInput
        placeholder="2 nights in NYC, big on food…"
        onSubmit={onSubmit}
        submitLabel="Plan it"
        isSubmitting={isGenerating}
      />
      {error && <p className="text-center text-sm text-rose-600">{error}</p>}
      <p className="text-center text-sm text-[color:var(--ink-muted)]">
        Describe a trip. We&rsquo;ll build the plan.
      </p>
    </div>
  );
}
