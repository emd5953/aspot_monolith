'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';

interface LogoutButtonProps {
  /** `light` uses white text for photo/video hero contexts */
  tone?: 'default' | 'light';
}

export function LogoutButton({ tone = 'default' }: LogoutButtonProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  if (tone === 'light') {
    return (
      <button
        onClick={handleLogout}
        className="rounded-full px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:text-white [text-shadow:0_1px_3px_rgba(10,30,60,0.45),0_4px_16px_rgba(10,30,60,0.35)]"
      >
        Sign out
      </button>
    );
  }

  return (
    <HandDrawnButton onClick={handleLogout} variant="ghost" size="sm">
      Sign out
    </HandDrawnButton>
  );
}
