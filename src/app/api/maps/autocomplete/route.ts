import { NextRequest, NextResponse } from 'next/server';
import { getPlaceAutocomplete } from '@/lib/maps/google-maps-service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const input = searchParams.get('input');
    const types = searchParams.get('types')?.split(',');

    if (!input) {
      return NextResponse.json(
        { error: 'Input parameter required' },
        { status: 400 }
      );
    }

    const suggestions = await getPlaceAutocomplete(input, types);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Autocomplete API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch suggestions' },
      { status: 500 }
    );
  }
}
