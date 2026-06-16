import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityCard } from './activity-card';
import { SOURCE_LABELS } from '@/lib/ai/provenance';

/**
 * The provenance badge is the user-facing payoff of carrying `source` through
 * the pipeline. These render the card and assert the right label shows (or
 * doesn't, when source is absent).
 */

const baseActivity = {
  id: 'a1',
  title: 'The Dead Rabbit',
  description: 'Historic Irish pub',
  category: 'nightlife',
  sortOrder: 1,
};

describe('ActivityCard provenance badge', () => {
  it('shows the Reddit-favorite badge when sourced from reddit', () => {
    render(<ActivityCard activity={{ ...baseActivity, source: 'reddit' }} />);
    expect(screen.getByText(SOURCE_LABELS.reddit)).toBeInTheDocument();
  });

  it('shows the Google-verified badge when sourced from places', () => {
    render(<ActivityCard activity={{ ...baseActivity, source: 'places' }} />);
    expect(screen.getByText(SOURCE_LABELS.places)).toBeInTheDocument();
  });

  it('labels an AI-suggested pick honestly', () => {
    render(<ActivityCard activity={{ ...baseActivity, source: 'ai' }} />);
    expect(screen.getByText(SOURCE_LABELS.ai)).toBeInTheDocument();
  });

  it('renders no provenance badge when source is absent', () => {
    render(<ActivityCard activity={baseActivity} />);
    for (const label of Object.values(SOURCE_LABELS)) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });
});
