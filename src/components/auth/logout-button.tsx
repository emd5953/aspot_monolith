'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

interface LogoutButtonProps {
  /** `cinematic` uses white text for the video-backed screens. */
  tone?: 'cinematic' | 'paper';
}

export function LogoutButton({ tone = 'paper' }: LogoutButtonProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  if (tone === 'cinematic') {
    return (
      <button
        onClick={handleLogout}
        className="rounded-full px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:text-white"
      >
        Sign out
      </button>
    );
  }

  return (
    <Button onClick={handleLogout} variant="ghost" size="sm">
      Sign out
    </Button>
  );
}
