'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';

export function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <HandDrawnButton onClick={handleLogout} variant="ghost" size="sm">
      Sign out
    </HandDrawnButton>
  );
}
