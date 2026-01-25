/**
 * Google Maps Service
 * Handles geocoding, places, and distance calculations
 */

export interface PlaceAutocomplete {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface PlaceDetails {
  placeId: string;
  name: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  types: string[];
}

export interface DistanceResult {
  distance: {
    text: string;
    value: number; // meters
  };
  duration: {
    text: string;
    value: number; // seconds
  };
}

/**
 * Get place autocomplete suggestions
 */
export async function getPlaceAutocomplete(
  input: string,
  types?: string[]
): Promise<PlaceAutocomplete[]> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('Google Maps API key not configured');
  }

  const params = new URLSearchParams({
    input,
    key: apiKey,
    ...(types && { types: types.join('|') }),
  });

  // If no types specified, use (regions) to get cities, neighborhoods, and specific areas
  if (!types || types.length === 0) {
    params.set('types', '(regions)');
  }

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch autocomplete');
  }

  const data = await response.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Maps API error: ${data.status}`);
  }

  return (data.predictions || []).map((pred: {
    place_id: string;
    description: string;
    structured_formatting: {
      main_text: string;
      secondary_text: string;
    };
  }) => ({
    placeId: pred.place_id,
    description: pred.description,
    mainText: pred.structured_formatting.main_text,
    secondaryText: pred.structured_formatting.secondary_text,
  }));
}

/**
 * Get place details by place ID
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('Google Maps API key not configured');
  }

  const params = new URLSearchParams({
    place_id: placeId,
    key: apiKey,
    fields: 'place_id,name,formatted_address,geometry,types',
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${params}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch place details');
  }

  const data = await response.json();

  if (data.status !== 'OK') {
    throw new Error(`Google Maps API error: ${data.status}`);
  }

  const result = data.result;
  return {
    placeId: result.place_id,
    name: result.name,
    address: result.formatted_address,
    location: {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
    },
    types: result.types || [],
  };
}

/**
 * Geocode an address to coordinates
 */
export async function geocodeAddress(address: string): Promise<{
  lat: number;
  lng: number;
  formattedAddress: string;
}> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('Google Maps API key not configured');
  }

  const params = new URLSearchParams({
    address,
    key: apiKey,
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params}`
  );

  if (!response.ok) {
    throw new Error('Failed to geocode address');
  }

  const data = await response.json();

  if (data.status !== 'OK' || !data.results[0]) {
    throw new Error(`Geocoding failed: ${data.status}`);
  }

  const result = data.results[0];
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
  };
}

/**
 * Calculate distance and duration between two points
 */
export async function getDistanceMatrix(
  origins: string[],
  destinations: string[]
): Promise<DistanceResult[][]> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('Google Maps API key not configured');
  }

  const params = new URLSearchParams({
    origins: origins.join('|'),
    destinations: destinations.join('|'),
    key: apiKey,
    mode: 'walking', // or 'driving', 'transit'
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch distance matrix');
  }

  const data = await response.json();

  if (data.status !== 'OK') {
    throw new Error(`Distance Matrix API error: ${data.status}`);
  }

  return data.rows.map((row: { elements: Array<{
    distance: { text: string; value: number };
    duration: { text: string; value: number };
    status: string;
  }> }) =>
    row.elements.map((element) => ({
      distance: element.distance,
      duration: element.duration,
    }))
  );
}
