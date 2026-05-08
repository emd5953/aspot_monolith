'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

/**
 * Landing-hero prompt input. Designed to sit on a photo background:
 * frosty white pill, no harsh borders, warm placeholder copy.
 * On submit, stashes the prompt and routes to signup so it can seed
 * the first itinerary post-auth.
 */
export function SkyPrompt() {
  const router = useRouter();
  const [value, setValue] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    try {
      sessionStorage.setItem('aspot:pending-prompt', trimmed);
    } catch {
      /* sessionStorage can be unavailable (private mode, etc.) — ignore. */
    }
    router.push('/signup');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="group mx-auto flex w-full max-w-xl items-center gap-2 rounded-full bg-white/85 px-2 py-2 pl-6 shadow-[0_24px_60px_-20px_rgba(20,40,80,0.45)] backdrop-blur-md transition-all focus-within:bg-white/95"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="A long weekend in Lisbon…"
        aria-label="Describe your trip"
        className="flex-1 bg-transparent py-2.5 text-base text-slate-800 placeholder:text-slate-500/70 outline-none"
      />
      <button
        type="submit"
        aria-label="Start planning"
        disabled={!value.trim()}
        className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-slate-900 px-5 text-sm font-medium text-white transition-all hover:bg-slate-800 hover:-translate-y-[1px] disabled:opacity-50 disabled:hover:translate-y-0"
      >
        Plan it
        <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </form>
  );
}
