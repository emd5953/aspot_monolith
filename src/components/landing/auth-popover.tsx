'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Mode = 'login' | 'signup';

interface AuthPopoverProps {
  mode: Mode;
  onClose: () => void;
  onSwitchMode: (next: Mode) => void;
}

// Heavy shadow stack so white reads over any background (clouds, buildings).
const TEXT_SHADOW =
  '[text-shadow:0_1px_3px_rgba(10,25,55,0.8),0_4px_18px_rgba(10,25,55,0.6)]';

/**
 * Transparent-background popover. Inputs are dark-tinted glass (readable
 * over clouds OR skyline), the primary CTA is solid dark ink, and all text
 * has a heavy drop-shadow stack to stay legible.
 */
export function AuthPopover({ mode, onClose, onSwitchMode }: AuthPopoverProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const raf = requestAnimationFrame(() => {
      document.addEventListener('mousedown', handleClick);
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    setError(null);
    setVerificationSent(false);
  }, [mode]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setError(error.message);
        setLoading(false);
      } else {
        window.location.href = '/dashboard';
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: displayName.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
      } else {
        setVerificationSent(true);
        setLoading(false);
      }
    }
  };

  const handleGoogle = async () => {
    if (loadingGoogle) return;
    setLoadingGoogle(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoadingGoogle(false);
    }
  };

  if (verificationSent) {
    return (
      <div
        ref={wrapperRef}
        className="animate-popover-in absolute right-0 top-full mt-3 w-[300px] origin-top-right p-4"
      >
        <p className={`text-base font-bold text-white ${TEXT_SHADOW}`}>
          Check your inbox
        </p>
        <p className={`mt-2 text-sm font-medium text-white ${TEXT_SHADOW}`}>
          We sent a confirmation link to{' '}
          <span className="font-semibold">{email}</span>. Tap it to finish.
        </p>
        <button
          type="button"
          onClick={onClose}
          className={`mt-4 text-xs font-semibold text-white underline decoration-white/80 underline-offset-2 hover:decoration-white ${TEXT_SHADOW}`}
        >
          Got it
        </button>
      </div>
    );
  }

  const submitLabel =
    mode === 'login'
      ? loading
        ? 'Signing in…'
        : 'Sign in'
      : loading
        ? 'Creating…'
        : 'Create account';

  // Solid-ish dark input pill. Strong enough to read clearly, still shows
  // a hint of the sky through. Bumped up from the earlier too-ghostly version.
  const inputClass =
    'w-full rounded-full border border-white/80 bg-slate-900/65 px-4 py-2.5 text-sm font-medium text-white placeholder:text-white/85 outline-none transition-all backdrop-blur-xl shadow-[0_10px_24px_-10px_rgba(10,25,55,0.55)] focus:border-white focus:bg-slate-900/80';

  return (
    <div
      ref={wrapperRef}
      className="animate-popover-in absolute right-0 top-full mt-3 w-[300px] origin-top-right p-4"
    >
      <p
        className={`text-xs font-bold uppercase tracking-wider text-white ${TEXT_SHADOW}`}
      >
        {mode === 'login' ? 'Welcome back' : 'Create your account'}
      </p>

      <form onSubmit={handleSubmit} className="mt-3 space-y-2.5">
        {mode === 'signup' && (
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            required
            className={inputClass}
          />
        )}

        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className={inputClass}
        />

        <input
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === 'login' ? 'Password' : 'Pick a password'}
          required
          className={inputClass}
        />

        {error && (
          <p
            className={`rounded-full bg-rose-500/80 px-4 py-2 text-center text-xs font-semibold text-white backdrop-blur-md ${TEXT_SHADOW}`}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !email.trim() || !password}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_-8px_rgba(10,25,55,0.8)] ring-1 ring-white/25 transition-all hover:-translate-y-[1px] hover:bg-slate-800 disabled:opacity-85 disabled:hover:translate-y-0"
        >
          {submitLabel}
          {!loading && <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />}
        </button>
      </form>

      <div
        className={`my-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white ${TEXT_SHADOW}`}
      >
        <span className="h-px flex-1 bg-white/50" />
        or
        <span className="h-px flex-1 bg-white/50" />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={loadingGoogle}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/80 bg-slate-900/65 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(10,25,55,0.55)] backdrop-blur-xl transition-all hover:border-white hover:bg-slate-900/80 disabled:opacity-60"
      >
        <GoogleGlyph />
        Continue with Google
      </button>

      <p className={`mt-4 text-center text-xs font-medium text-white ${TEXT_SHADOW}`}>
        {mode === 'login' ? "Don't have one? " : 'Already signed up? '}
        <button
          type="button"
          onClick={() => onSwitchMode(mode === 'login' ? 'signup' : 'login')}
          className="font-bold underline decoration-white/80 underline-offset-2 hover:decoration-white"
        >
          {mode === 'login' ? 'Sign up' : 'Log in'}
        </button>
      </p>
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
