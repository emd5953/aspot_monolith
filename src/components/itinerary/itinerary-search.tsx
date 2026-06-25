'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Sparkles, Zap } from 'lucide-react';
import { PromptInput } from '@/components/ui/prompt-input';
import { KanyeQuote } from '@/components/itinerary/kanye-quote';

interface ItinerarySearchProps {
  /**
   * `default`: white frosted pill on a light page background
   * `light`: frosty on-photo pill for hero sections over a video or photo
   */
  tone?: 'default' | 'light';
}

type Mode = 'fast' | 'deep';

/**
 * Example prompts cycled into the input placeholder. A fresh one is picked on
 * each page load (client-side, post-hydration) so the suggestion feels alive.
 */
const EXAMPLE_PROMPTS = [
  '2 nights in nyc, big on food…',
  '4 days in tokyo, food focused…',
  'a long weekend in lisbon, lots of viewpoints…',
  '5 days in rome, history and pasta…',
  '3 days in paris, art and cafés…',
  'a week in barcelona, beaches and tapas…',
  '3 nights in london, theatre and markets…',
  '4 days in mexico city, a street-food crawl…',
  'a weekend in amsterdam, canals and museums…',
  '5 days in bangkok, temples and night markets…',
];

/**
 * One-shot itinerary generator. Two modes:
 *
 * - **Fast** (default): user waits on the loading overlay (~10-30s), then
 *   gets routed to the new itinerary page.
 * - **Deep**: user's request is fired off; we show a confirmation toast
 *   ("we'll email you when it's ready") and let them keep using the app.
 *   The server runs the heavy pipeline via `waitUntil` and emails the
 *   itinerary on completion.
 */
export function ItinerarySearch({ tone = 'default' }: ItinerarySearchProps) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [mode, setMode] = useState<Mode>('fast');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deepConfirmation, setDeepConfirmation] = useState<string | null>(null);
  // Start on a fixed example so server and client first render match, then
  // swap to a random one after mount — keeps it fresh per refresh without a
  // hydration mismatch.
  const [placeholder, setPlaceholder] = useState(EXAMPLE_PROMPTS[0]);

  useEffect(() => {
    setPlaceholder(
      EXAMPLE_PROMPTS[Math.floor(Math.random() * EXAMPLE_PROMPTS.length)]
    );
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
        // Deep mode: show toast, clear prompt, free the user.
        setDeepConfirmation(data.message ?? "We'll email you when it's ready.");
        setValue('');
        setIsGenerating(false);
        // Auto-dismiss the toast after 8s.
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

  return (
    <>
      {isGenerating ? (
        // While a request is in flight, collapse the whole input — pill, mode
        // picker, captions — down to just the loader so nothing competes with
        // it. Fast mode then routes to the itinerary; deep mode flips back to
        // the input (isGenerating → false) and shows the "we'll email you" toast.
        <div className="animate-fade-up flex w-full flex-col items-center gap-4 py-4 text-center">
          <span className="h-11 w-11 animate-spin rounded-full border-[3.5px] border-white/45 border-t-white" />
          <p className="loading-dots font-heading text-2xl font-bold leading-tight text-white [text-shadow:0_2px_5px_rgba(10,30,60,0.65)]">
            Building your trip
          </p>
          <p className="max-w-[16rem] text-sm font-semibold leading-relaxed text-white [text-shadow:0_2px_4px_rgba(10,30,60,0.6)]">
            Researching spots and pacing your days.
          </p>
          <KanyeQuote />
        </div>
      ) : tone === 'light' ? (
        <LightPill
          value={value}
          setValue={setValue}
          mode={mode}
          setMode={setMode}
          onSubmit={handleGenerate}
          isGenerating={isGenerating}
          error={error}
          deepConfirmation={deepConfirmation}
          placeholder={placeholder}
        />
      ) : (
        <DefaultInput
          mode={mode}
          setMode={setMode}
          onSubmit={handleGenerate}
          isGenerating={isGenerating}
          error={error}
          deepConfirmation={deepConfirmation}
          placeholder={placeholder}
        />
      )}
    </>
  );
}

interface ModePickerProps {
  mode: Mode;
  setMode: (m: Mode) => void;
  tone: 'default' | 'light';
  disabled?: boolean;
}

/**
 * Two-pill selector for fast vs deep mode. Visual is tuned per-tone so it
 * reads well over the video (light) or on a white surface (default).
 */
function ModePicker({ mode, setMode, tone, disabled }: ModePickerProps) {
  const isLight = tone === 'light';

  const baseStyle =
    'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all disabled:opacity-50';

  const activeLight =
    'bg-white/95 text-slate-900 shadow-[0_8px_18px_-8px_rgba(10,25,55,0.45)]';
  const inactiveLight =
    'bg-white/15 text-white border border-white/35 hover:bg-white/25';

  const activeDark =
    'bg-[color:var(--ink)] text-white shadow-[0_8px_18px_-8px_rgba(11,30,60,0.45)]';
  const inactiveDark =
    'bg-white text-[color:var(--ink-muted)] border border-[color:var(--border)] hover:border-[color:var(--border-strong)]';

  const activeStyle = isLight ? activeLight : activeDark;
  const inactiveStyle = isLight ? inactiveLight : inactiveDark;

  return (
    <div className="flex justify-center gap-2">
      <button
        type="button"
        onClick={() => setMode('fast')}
        disabled={disabled}
        className={`${baseStyle} ${mode === 'fast' ? activeStyle : inactiveStyle}`}
      >
        <Zap className="h-3.5 w-3.5" strokeWidth={2.5} />
        Fast
      </button>
      <button
        type="button"
        onClick={() => setMode('deep')}
        disabled={disabled}
        className={`${baseStyle} ${mode === 'deep' ? activeStyle : inactiveStyle}`}
      >
        <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
        Deep research
      </button>
    </div>
  );
}

interface LightPillProps {
  value: string;
  setValue: (v: string) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  onSubmit: (prompt: string) => void;
  isGenerating: boolean;
  error: string | null;
  deepConfirmation: string | null;
  placeholder: string;
}

function LightPill({
  value,
  setValue,
  mode,
  setMode,
  onSubmit,
  isGenerating,
  error,
  deepConfirmation,
  placeholder,
}: LightPillProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || isGenerating) return;
    onSubmit(trimmed);
  };

  const submitLabel = mode === 'deep' ? 'Send it' : 'Plan it';

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
          placeholder={placeholder}
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
              {submitLabel}
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </>
          )}
        </button>
      </form>

      <div className="mt-3">
        <ModePicker mode={mode} setMode={setMode} tone="light" disabled={isGenerating} />
      </div>

      <p className="mt-3 text-center text-xs font-medium text-white/85 [text-shadow:0_1px_3px_rgba(10,30,60,0.5)]">
        {mode === 'fast'
          ? 'Quick draft in seconds. Tweak after.'
          : "We'll spend longer researching and email it when it's ready."}
      </p>

      {error && (
        <p className="mt-3 text-center text-sm font-medium text-white [text-shadow:0_1px_3px_rgba(10,30,60,0.6)]">
          {error}
        </p>
      )}

      {deepConfirmation && (
        <div
          className="animate-fade-up mx-auto mt-4 max-w-md rounded-2xl border border-white/60 bg-white/95 px-4 py-3 text-center shadow-[0_24px_60px_-20px_rgba(10,25,55,0.5)] backdrop-blur-md"
          role="status"
        >
          <p className="text-sm font-semibold text-slate-900">On it ✈️</p>
          <p className="mt-1 text-xs text-slate-600">{deepConfirmation}</p>
        </div>
      )}
    </div>
  );
}

interface DefaultInputProps {
  mode: Mode;
  setMode: (m: Mode) => void;
  onSubmit: (prompt: string) => void;
  isGenerating: boolean;
  error: string | null;
  deepConfirmation: string | null;
  placeholder: string;
}

function DefaultInput({
  mode,
  setMode,
  onSubmit,
  isGenerating,
  error,
  deepConfirmation,
  placeholder,
}: DefaultInputProps) {
  return (
    <div className="space-y-3">
      <PromptInput
        placeholder={placeholder}
        onSubmit={onSubmit}
        submitLabel={mode === 'deep' ? 'Send it' : 'Plan it'}
        isSubmitting={isGenerating}
      />

      <ModePicker mode={mode} setMode={setMode} tone="default" disabled={isGenerating} />

      <p className="text-center text-sm text-[color:var(--ink-muted)]">
        {mode === 'fast'
          ? 'Quick draft in seconds. Tweak after.'
          : "We'll research deeper and email it when it's ready."}
      </p>

      {error && <p className="text-center text-sm text-rose-600">{error}</p>}

      {deepConfirmation && (
        <div
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center"
          role="status"
        >
          <p className="text-sm font-semibold text-emerald-900">On it ✈️</p>
          <p className="mt-1 text-xs text-emerald-700">{deepConfirmation}</p>
        </div>
      )}
    </div>
  );
}
