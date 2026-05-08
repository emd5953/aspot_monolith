'use client';

import { useState } from 'react';
import { Copy, Check, RefreshCw } from 'lucide-react';

interface InviteLinkProps {
  inviteCode: string;
  onRegenerate?: () => Promise<void>;
}

export function InviteLink({ inviteCode, onRegenerate }: InviteLinkProps) {
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/trips/join?code=${inviteCode}`
      : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl || inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleRegenerate = async () => {
    if (!onRegenerate) return;
    if (!confirm('Regenerate invite code? The old link will no longer work.')) return;

    setIsRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-[color:var(--ink-muted)]">Invite link</p>

        {onRegenerate && (
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--ink-muted)] transition-colors hover:text-[color:var(--ink)] disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3 w-3 ${isRegenerating ? 'animate-spin' : ''}`}
              strokeWidth={2.5}
            />
            Regenerate
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 truncate rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-2.5 text-sm text-[color:var(--ink)]">
          {inviteUrl || `Code: ${inviteCode}`}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : 'Copy invite link'}
          title={copied ? 'Copied' : 'Copy invite link'}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--ink)] text-white transition-all hover:bg-[color:var(--ink)]/90 hover:-translate-y-[1px]"
        >
          {copied ? (
            <Check className="h-4 w-4" strokeWidth={2.5} />
          ) : (
            <Copy className="h-4 w-4" strokeWidth={2} />
          )}
        </button>
      </div>

      <p className="mt-2 text-xs text-[color:var(--ink-soft)]">
        Share this link with friends to invite them to your trip
      </p>
    </div>
  );
}
