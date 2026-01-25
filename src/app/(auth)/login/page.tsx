'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';
import { HandDrawnInput } from '@/components/ui/hand-drawn-input';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    const msg = searchParams.get('message');
    const err = searchParams.get('error');
    if (msg) setMessage(msg);
    if (err) setError(err);
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Force a full page reload to refresh server-side session
      window.location.href = '/dashboard';
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-6">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-between mb-6">
            <Link href="/">
              <HandDrawnButton variant="secondary" size="sm">
                ← Home
              </HandDrawnButton>
            </Link>
            <Link href="/" className="inline-block">
              <h1 className="text-4xl font-heading text-foreground -rotate-2">
                ✈️ aSpot - AI Itinerary Planner
              </h1>
            </Link>
            <div className="w-20"></div> {/* Spacer for balance */}
          </div>
          <h2 className="text-3xl font-heading text-foreground">
            Sign in to your account
          </h2>
        </div>

        <HandDrawnCard decoration="tape" className="mt-8">
          <form className="space-y-6" onSubmit={handleLogin}>
            {message && (
              <div className="bg-secondary-accent/10 border-2 border-secondary-accent border-wobbly-sm text-foreground px-4 py-3">
                {message}
              </div>
            )}
            {error && (
              <div className="bg-accent/10 border-2 border-accent border-wobbly-sm text-foreground px-4 py-3">
                {error}
              </div>
            )}

            <HandDrawnInput
              label="Email address"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <HandDrawnInput
              label="Password"
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <HandDrawnButton
              type="submit"
              disabled={loading}
              variant="accent"
              className="w-full"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </HandDrawnButton>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-dashed border-foreground/30" />
              </div>
              <div className="relative flex justify-center text-base">
                <span className="px-4 bg-card text-foreground/70">Or continue with</span>
              </div>
            </div>

            {/* Google Login */}
            <HandDrawnButton
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              variant="secondary"
              className="w-full flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </HandDrawnButton>

            <div className="text-center mt-6">
              <Link href="/signup" className="text-secondary-accent hover:underline text-lg">
                Don&apos;t have an account? Sign up
              </Link>
            </div>
          </form>
        </HandDrawnCard>
      </div>
    </div>
  );
}
