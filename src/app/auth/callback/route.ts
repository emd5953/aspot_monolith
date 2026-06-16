import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  console.log('Auth callback hit:', { code: !!code, origin, next });

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    console.log('Exchange code result:', { error: error?.message });
    
    if (!error) {
      const redirectUrl = `${origin}${next}`;
      console.log('Redirecting to:', redirectUrl);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Auth failed (missing/expired/invalid code). Send the user back to the
  // landing page — which hosts the login/signup popover — with an error flag
  // it surfaces so they can retry. There is no standalone /login route, so
  // redirecting there would 404 and dead-end the onboarding flow.
  console.log('Auth failed, redirecting to landing');
  return NextResponse.redirect(`${origin}/?authError=1`);
}
