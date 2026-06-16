import { describe, it, expect } from 'vitest';
import { coordsColumns, mapActivityFromDb } from './itinerary-service';

/**
 * Regression guard for the audit find: activity coordinates were mapped to a
 * `location_coords` column that doesn't exist (the schema has separate
 * `location_lat` / `location_lng` DECIMALs). That silently dropped coords on
 * read and would 500 an add/edit that sent coords. These lock the real mapping.
 */

describe('coordsColumns (write side)', () => {
  it('splits a coordinate into the real lat/lng columns', () => {
    expect(coordsColumns({ lat: 40.7128, lng: -74.006 })).toEqual({
      location_lat: 40.7128,
      location_lng: -74.006,
    });
  });

  it('writes nulls (never a phantom location_coords) when coords are absent', () => {
    expect(coordsColumns(undefined)).toEqual({ location_lat: null, location_lng: null });
  });
});

describe('mapActivityFromDb (read side)', () => {
  const baseRow = {
    id: 'a1',
    day_id: 'd1',
    title: 'Museum',
    description: '',
    category: 'attraction',
    sort_order: 1,
    created_at: '2026-06-16T00:00:00Z',
    updated_at: '2026-06-16T00:00:00Z',
  };

  it('reassembles coords from lat/lng, coercing PostgREST decimal strings', () => {
    const activity = mapActivityFromDb({ ...baseRow, location_lat: '40.7128', location_lng: '-74.006' });
    expect(activity.locationCoords).toEqual({ lat: 40.7128, lng: -74.006 });
  });

  it('leaves coords undefined when the columns are null', () => {
    const activity = mapActivityFromDb({ ...baseRow, location_lat: null, location_lng: null });
    expect(activity.locationCoords).toBeUndefined();
  });

  it('does not invent coords from a single axis', () => {
    const activity = mapActivityFromDb({ ...baseRow, location_lat: '40.7', location_lng: null });
    expect(activity.locationCoords).toBeUndefined();
  });
});
