'use client';

import { useState } from 'react';
import { PromptInput } from '@/components/ui/prompt-input';

interface SkyPromptProps {
  /**
   * Called when the user submits a prompt while unauthed. The parent stashes
   * the prompt and opens the auth popover in place, rather than navigating
   * away from the landing page.
   */
  onSubmit: (value: string) => void;
}

/** Landing-hero prompt. Thin wrapper so the landing keeps its own state. */
export function SkyPrompt({ onSubmit }: SkyPromptProps) {
  const [value, setValue] = useState('');

  return (
    <PromptInput
      tone="cinematic"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onSubmit={onSubmit}
      placeholder="find the moves for tonight…"
      aria-label="Describe the vibe"
      submitLabel="Plan it"
    />
  );
}
