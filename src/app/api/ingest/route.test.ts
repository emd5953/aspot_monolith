import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { enabledSources, upsertCandidates, expireCandidates } from '@/lib/sources';
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({})) }));
vi.mock('@/lib/sources', () => ({
  enabledSources: vi.fn(),
  upsertCandidates: vi.fn(),
  expireCandidates: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CRON_SECRET', 'fixture-secret');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://fixture.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'fixture-key');
  vi.mocked(upsertCandidates).mockResolvedValue(0);
  vi.mocked(expireCandidates).mockResolvedValue(0);
});
afterEach(() => vi.unstubAllEnvs());
describe('ingest source coverage', () => {
  it('reports a partial connector run as 207 and preserves successful writes', async () => {
    vi.mocked(enabledSources).mockReturnValue([
      {
        name: 'posh',
        enabled: () => true,
        fetchCandidates: async (options) => {
          options?.onWarning?.('Page 2 failed; coverage is partial.');
          return [];
        },
      },
    ]);
    const response = await GET(
      new NextRequest('http://localhost/api/ingest', {
        headers: { Authorization: 'Bearer fixture-secret' },
      })
    );
    expect(response.status).toBe(207);
    expect(await response.json()).toMatchObject({
      ok: false,
      partialSources: ['posh'],
      results: {
        posh: { fetched: 0, written: 0, warnings: ['Page 2 failed; coverage is partial.'] },
      },
    });
    expect(upsertCandidates).toHaveBeenCalled();
  });
  it('reports a total source outage separately', async () => {
    vi.mocked(enabledSources).mockReturnValue([
      {
        name: 'partiful',
        enabled: () => true,
        fetchCandidates: async () => {
          throw new Error('discovery unavailable');
        },
      },
    ]);
    const response = await GET(
      new NextRequest('http://localhost/api/ingest', {
        headers: { Authorization: 'Bearer fixture-secret' },
      })
    );
    expect(response.status).toBe(207);
    expect(await response.json()).toMatchObject({ ok: false, failedSources: ['partiful'] });
    expect(upsertCandidates).not.toHaveBeenCalled();
  });
});
