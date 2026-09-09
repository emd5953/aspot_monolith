'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PromptInput } from '@/components/ui/prompt-input';
import { ModePicker, type Mode } from '@/components/ui/mode-picker';

interface ItinerarySearchProps {
  /** Matches the surface the search sits on. */
  tone?: 'cinematic' | 'paper';
}

/**
 * Example prompts cycled into the input placeholder. A fresh one is picked on
 * each page load (client-side, post-hydration) so the suggestion feels alive.
 */
const EXAMPLE_PROMPTS = [
  'dinner then somewhere loud…',
  'low-key, walkable, brooklyn…',
  'rooftop, not touristy…',
  'birthday dinner for six…',
  'live music, no cover…',
  'late-night food after 1am…',
  'first date, quiet enough to talk…',
  'day party, outdoors…',
];

/**
 * One-shot itinerary generator. Two modes:
 *
 * - **Fast** (default): user waits on the loading state (~10-30s), then gets
 *   routed to the new itinerary page.
 * - **Deep**: the request is fired off; we show a confirmation line and let
 *   them keep using the app. The server runs the heavy pipeline via
 *   `waitUntil` and emails the itinerary on completion.
 */
export function ItinerarySearch({ tone = 'paper' }: ItinerarySearchProps) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [mode, setMode] = useState<Mode>('fast');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deepConfirmation, setDeepConfirmation] = useState<string | null>(null);
  // Start on a fixed example so server and client first render match, then
  // swap to a random one after mount — fresh per refresh, no hydration
  // mismatch.
  const [placeholder, setPlaceholder] = useState(EXAMPLE_PROMPTS[0]);

  const isCinematic = tone === 'cinematic';

  useEffect(() => {
    setPlaceholder(EXAMPLE_PROMPTS[Math.floor(Math.random() * EXAMPLE_PROMPTS.length)]);
  }, []);

  const handleGenerate = async (prompt: string) => {
    setIsGenerating(true);
    setError(null);
    setDeepConfirmation(null);

    try {
      const res = await fetch('/api/itinerary/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate');
      }

      const data = await res.json();

      if (data.pending) {
        // Deep mode: confirm, clear the prompt, free the user.
        setDeepConfirmation(data.message ?? "We'll email you when it's ready.");
        setValue('');
        setIsGenerating(false);
        setTimeout(() => setDeepConfirmation(null), 8000);
      } else if (data.itinerary) {
        // Fast mode: head straight to the new itinerary.
        router.push(`/itinerary/${data.itinerary.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsGenerating(false);
    }
  };

  // While a request is in flight, collapse to the loader alone. Fast mode then
  // routes away; deep mode flips back to the input with a confirmation.
  if (isGenerating) {
    return (
      <div className="flex w-full flex-col items-center gap-3 py-4">
        <span
          className={`h-8 w-8 animate-spin rounded-full border-[3px] border-t-transparent ${
            isCinematic ? 'border-white' : 'border-[color:var(--ink)]'
          }`}
        />
        <p
          className={`loading-dots text-sm font-medium ${
            isCinematic ? 'text-white' : 'text-[color:var(--ink-muted)]'
          }`}
        >
          Finding moves
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <PromptInput
        tone={tone}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onSubmit={handleGenerate}
        placeholder={placeholder}
        aria-label="Describe the vibe"
        submitLabel={mode === 'deep' ? 'Send it' : 'Plan it'}
        isSubmitting={isGenerating}
      />

      <div className="mt-3 flex justify-center">
        <ModePicker mode={mode} setMode={setMode} tone={tone} />
      </div>

      {error && (
        <p
          className={`mt-3 text-center text-sm font-medium ${
            isCinematic ? 'text-white' : 'text-rose-600'
          }`}
          role="alert"
        >
          {error}
        </p>
      )}

      {deepConfirmation && (
        <p
          className={`mt-3 text-center text-sm ${
            isCinematic ? 'text-white/90' : 'text-[color:var(--ink-muted)]'
          }`}
          role="status"
        >
          {deepConfirmation}
        </p>
      )}
    </div>
  );
}
