'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';
import { HandDrawnInput } from '@/components/ui/hand-drawn-input';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      window.location.href = '/login?message=Check your email to confirm your account';
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <main className="relative mx-auto flex min-h-screen max-w-md items-center justify-center px-6 py-20">
        <div className="w-full animate-fade-up">
          <Link
            href="/"
            className="mb-10 inline-flex items-center gap-2 text-sm text-[color:var(--ink-muted)] transition-colors hover:text-[color:var(--ink)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
            Back to home
          </Link>

          <div className="mb-8">
            <p className="mb-3 text-sm font-medium text-[color:var(--ink-muted)]">Start planning</p>
            <h1 className="font-heading text-5xl leading-[1.05] text-[color:var(--ink)]">
              Create your <span className="italic">account</span>.
            </h1>
          </div>

          <HandDrawnCard className="p-7">
            <form className="space-y-5" onSubmit={handleSignUp}>
              {error && (
                <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {error}
                </div>
              )}

              <HandDrawnInput
                label="Display name"
                id="displayName"
                name="displayName"
                type="text"
                required
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />

              <HandDrawnInput
                label="Email address"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <div>
                <HandDrawnInput
                  label="Password"
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="mt-2 text-xs text-[color:var(--ink-soft)]">Minimum 6 characters</p>
              </div>

              <HandDrawnButton
                type="submit"
                disabled={loading}
                variant="primary"
                className="w-full gap-2"
              >
                {loading ? 'Creating account…' : 'Create account'}
                {!loading && <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />}
              </HandDrawnButton>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[color:var(--border)]" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-xs text-[color:var(--ink-soft)]">or</span>
                </div>
              </div>

              <HandDrawnButton
                type="button"
                onClick={handleGoogleSignUp}
                disabled={loading}
                variant="secondary"
                className="w-full gap-3"
              >
                <GoogleGlyph />
                Continue with Google
              </HandDrawnButton>
            </form>
          </HandDrawnCard>

          <p className="mt-8 text-center text-sm text-[color:var(--ink-muted)]">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium text-[color:var(--ink)] underline decoration-[color:var(--ink-soft)] underline-offset-4 hover:decoration-[color:var(--ink)]"
            >
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
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
  );
}
