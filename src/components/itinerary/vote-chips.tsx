'use client';

import { useState } from 'react';

interface VoteChipsProps {
  planId: string;
  initialUp: number;
  initialDown: number;
  myVote: number; // 1 | -1 | 0
}

/**
 * 👍 n / 👎 n chips. Clicking toggles: voting the same way again clears it
 * (0). Updates apply optimistically; a failed POST reverts the counters.
 */
export function VoteChips({ planId, initialUp, initialDown, myVote }: VoteChipsProps) {
  const [up, setUp] = useState(initialUp);
  const [down, setDown] = useState(initialDown);
  const [vote, setVote] = useState(myVote);

  const cast = (next: 1 | -1) => {
    const prev = { up, down, vote };
    const nextVote = vote === next ? 0 : next;
    const delta = nextVote - vote;

    // Optimistic
    setVote(nextVote);
    if (delta === 1) {
      if (next === 1) setUp(up + 1);
      else setDown(down + 1);
    } else if (delta === -1) {
      if (next === 1) setUp(up - 1);
      else setDown(down - 1);
    } else if (delta === 2) {
      setUp(up + 1);
      setDown(down - 1);
    } else if (delta === -2) {
      setUp(up - 1);
      setDown(down + 1);
    }

    fetch(`/api/plans/${planId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote: nextVote }),
    }).catch(() => {
      // Revert on failure
      setUp(prev.up);
      setDown(prev.down);
      setVote(prev.vote);
    });
  };

  const chip = (dir: 1 | -1, count: number, active: boolean, label: string) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={vote === dir}
      onClick={() => cast(dir)}
      className={`tap-target inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
        active
          ? 'border-[color:var(--accent)]/50 bg-[color:var(--accent)]/10 text-[color:var(--accent)]'
          : 'border-[color:var(--border)] bg-white/70 text-[color:var(--ink-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--ink)]'
      }`}
    >
      <span aria-hidden>{dir === 1 ? '👍' : '👎'}</span>
      {count}
    </button>
  );

  return (
    <span className="inline-flex items-center gap-1.5">
      {chip(1, up, vote === 1, `Upvote, ${up}`)}
      {chip(-1, down, vote === -1, `Downvote, ${down}`)}
    </span>
  );
}
