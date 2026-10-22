import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { createClient } from '@/lib/supabase/server';
import { discoverConversation } from '@/lib/discovery/conversation';
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/discovery/conversation', () => ({ discoverConversation: vi.fn() }));
const getUser = vi.fn();
const request = (body: string) =>
  new NextRequest('http://localhost/api/discovery', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createClient).mockResolvedValue({ auth: { getUser } } as unknown as Awaited<
    ReturnType<typeof createClient>
  >);
  getUser.mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null });
});
describe('discovery adapter', () => {
  it('authenticates before parsing or querying', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request('{}'))).status).toBe(401);
    expect(discoverConversation).not.toHaveBeenCalled();
  });
  it.each([
    'not json',
    '{}',
    '{"messages":[]}',
    '{"messages":[{"role":"assistant","content":"hi"}]}',
  ])('rejects malformed input: %s', async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(discoverConversation).not.toHaveBeenCalled();
  });
  it('enforces a bounded message payload', async () => {
    expect((await POST(request('x'.repeat(16001)))).status).toBe(413);
  });
  it('returns a backend failure distinctly from a legitimate no-match result', async () => {
    vi.mocked(discoverConversation).mockRejectedValue(new Error('pool unavailable'));
    const result = await POST(
      request(JSON.stringify({ messages: [{ role: 'user', content: 'R&B tonight' }] }))
    );
    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ error: 'Discovery is temporarily unavailable' });
  });
});
