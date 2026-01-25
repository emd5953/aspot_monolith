'use client';

import { useState } from 'react';

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
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-700">Invite Link</h4>
        {onRegenerate && (
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            {isRegenerating ? 'Regenerating...' : 'Regenerate'}
          </button>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-white border rounded-lg px-3 py-2 text-sm text-gray-600 truncate">
          {inviteUrl || `Code: ${inviteCode}`}
        </div>
        <button
          onClick={handleCopy}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      
      <p className="text-xs text-gray-500 mt-2">
        Share this link with friends to invite them to your trip
      </p>
    </div>
  );
}
