import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { createClient } from '@/lib/supabase/server';

/**
 * The auth callback is the landing point for email-confirmation links and the
 * Google OAuth round-trip. A failed/expired code must NOT dead-end the user on
 * a route that doesn't exist — there is no standalone /login page, so failures
 * have to return to the landing page (which hosts the auth popover). These
 * tests lock the redirect targets for both outcomes.
 */

const mockedCreateClient = vi.mocked(createClient);

function callbackRequest(query: string) {
  return new Request(`http://localhost:3000/auth/callback${query}`);
}

function mockExchange(result: { error: { message: string } | null }) {
  mockedCreateClient.mockResolvedValue({
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue(result),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

describe('auth callback route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects a valid code to the dashboard', async () => {
    mockExchange({ error: null });
    const res = await GET(callbackRequest('?code=good-code'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/dashboard');
  });

  it('honors an explicit ?next destination on success', async () => {
    mockExchange({ error: null });
    const res = await GET(callbackRequest('?code=good-code&next=/itinerary'));
    expect(res.headers.get('location')).toBe('http://localhost:3000/itinerary');
  });

  it('redirects a failed code exchange back to the landing page, not /login', async () => {
    mockExchange({ error: { message: 'invalid code' } });
    const res = await GET(callbackRequest('?code=expired'));
    const location = res.headers.get('location') ?? '';
    expect(location).toBe('http://localhost:3000/?authError=1');
    // The old behavior pointed at a non-existent /login route (404 dead-end).
    expect(location).not.toContain('/login');
  });

  it('redirects to the landing page when no code is present', async () => {
    const res = await GET(callbackRequest(''));
    expect(res.headers.get('location')).toBe('http://localhost:3000/?authError=1');
  });
});
