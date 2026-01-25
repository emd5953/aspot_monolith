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

  // Return the user to an error page with instructions
  console.log('Auth failed, redirecting to login');
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`);
}
