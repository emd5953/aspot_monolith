'use client';

import { useRouter } from 'next/navigation';
import { PromptInput } from '@/components/ui/prompt-input';

/**
 * The hero prompt on the landing page. Unauthed users get redirected
 * to signup; the typed prompt is stashed so it can seed a first trip.
 */
export function LandingPrompt() {
  const router = useRouter();

  const handleSubmit = (value: string) => {
    try {
      sessionStorage.setItem('aspot:pending-prompt', value);
    } catch {
      // sessionStorage can be unavailable (private mode, etc.) — ignore.
    }
    router.push('/signup');
  };

  return (
    <PromptInput
      placeholder="A 5-day trip to Lisbon this summer…"
      onSubmit={handleSubmit}
      submitLabel="Start planning"
    />
  );
}
