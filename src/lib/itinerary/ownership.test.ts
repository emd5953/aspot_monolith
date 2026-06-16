import { describe, it, expect } from 'vitest';
import { ownerGuard } from './ownership';

describe('ownerGuard', () => {
  it('allows the owner', () => {
    expect(ownerGuard({ userId: 'u1' }, 'u1')).toEqual({ ok: true });
  });

  it('forbids a different user (403) — not a 404, the itinerary does exist', () => {
    expect(ownerGuard({ userId: 'owner' }, 'attacker')).toEqual({
      ok: false,
      status: 403,
      error: 'Forbidden',
    });
  });

  it('reports 404 when the itinerary is missing', () => {
    expect(ownerGuard(null, 'u1')).toEqual({
      ok: false,
      status: 404,
      error: 'Itinerary not found',
    });
    expect(ownerGuard(undefined, 'u1').ok).toBe(false);
  });
});
