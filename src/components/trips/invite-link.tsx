'use client';

import { useState } from 'react';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';

interface InviteLinkProps {
  inviteCode: string;
  onRegenerate?: () => Promise<void>;
}

export function InviteLink({ inviteCode, onRegenerate }: InviteLinkProps) {
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const inviteUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/trips/join?code=${inviteCode}`
    : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleRegenerate = async () => {
    if (!onRegenerate) return;
    setIsRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="bg-post-it/30 border-2 border-wobbly-sm border-foreground p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-lg font-heading text-foreground">🔗 Invite Link</h4>
        {onRegenerate && (
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="text-sm font-body text-foreground/70 hover:text-foreground disabled:opacity-50 underline"
          >
            {isRegenerating ? 'Regenerating...' : 'Regenerate'}
          </button>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-card border-2 border-foreground px-3 py-2 text-sm font-body text-foreground/80 truncate">
          {inviteUrl || `Code: ${inviteCode}`}
        </div>
        <HandDrawnButton
          onClick={handleCopy}
          variant="accent"
          size="sm"
        >
          {copied ? '✓ Copied!' : 'Copy'}
        </HandDrawnButton>
      </div>
      
      <p className="text-xs font-body text-foreground/60 mt-2">
        Share this link with friends to invite them to your trip
      </p>
    </div>
  );
}
