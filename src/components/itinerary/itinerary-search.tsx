'use client';

import { useRouter } from 'next/navigation';
import { PromptInput } from '@/components/ui/prompt-input';

/**
 * Prompt-style entry point on the dashboard. Stashes the typed idea in
 * sessionStorage so /itinerary can pre-fill the generate form.
 */
export function ItinerarySearch() {
  const router = useRouter();

  const handleSubmit = (value: string) => {
    try {
      sessionStorage.setItem('aspot:pending-prompt', value);
    } catch {
      /* ignore unavailable sessionStorage */
    }
    router.push('/itinerary?from=prompt');
  };

  return (
    <div className="space-y-4">
      <PromptInput
        placeholder="A long weekend in Tokyo, big on food and small museums…"
        onSubmit={handleSubmit}
        submitLabel="Plan it"
      />
      <p className="text-center text-sm text-[color:var(--ink-muted)]">
        Describe a trip. We&rsquo;ll build the plan.
      </p>
    </div>
  );
}
