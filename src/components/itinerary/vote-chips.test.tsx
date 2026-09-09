import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VoteChips } from './vote-chips';

/** VoteChips: optimistic toggle semantics over POST /api/plans/[planId]/vote. */

const post = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', post);
  post.mockResolvedValue({ ok: true, json: async () => ({}) });
});

describe('VoteChips', () => {
  it('renders the counts it is given', () => {
    render(<VoteChips planId="p1" initialUp={3} initialDown={1} myVote={0} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('posts a vote and updates optimistically on click', async () => {
    render(<VoteChips planId="p1" initialUp={3} initialDown={1} myVote={0} />);
    fireEvent.click(screen.getByRole('button', { name: /upvote/i }));
    expect(screen.getByText('4')).toBeInTheDocument();
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/api/plans/p1/vote',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ vote: 1 }),
        })
      )
    );
  });

  it('clicking the same vote again toggles it off', async () => {
    render(<VoteChips planId="p1" initialUp={3} initialDown={1} myVote={1} />);
    fireEvent.click(screen.getByRole('button', { name: /upvote/i }));
    expect(screen.getByText('2')).toBeInTheDocument();
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/api/plans/p1/vote',
        expect.objectContaining({ body: JSON.stringify({ vote: 0 }) })
      )
    );
  });

  it('switching from down to up moves both counts', async () => {
    render(<VoteChips planId="p1" initialUp={3} initialDown={1} myVote={-1} />);
    fireEvent.click(screen.getByRole('button', { name: /upvote/i }));
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});