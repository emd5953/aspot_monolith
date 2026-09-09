import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, username, avatar_url')
    .eq('id', user.id)
    .single();

  const displayName = profile?.display_name || 'You';
  const initial = displayName[0]?.toUpperCase() ?? '?';

  return (
    <main className="relative mx-auto max-w-3xl px-4 pt-16 pb-24 md:px-6">
      <HandDrawnCard className="animate-fade-up overflow-hidden p-0">
        <div className="px-5 pt-6 pb-5 md:px-8 md:pt-8 md:pb-7">
          <p className="text-sm font-medium text-[color:var(--ink-muted)]">Your Spotz card</p>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color:var(--border)] bg-white font-heading text-3xl text-[color:var(--ink)]">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-heading text-4xl leading-[1.05] text-[color:var(--ink)]">
                {displayName}
              </h1>
              {profile?.username && (
                <p className="text-sm text-[color:var(--ink-muted)]">@{profile.username}</p>
              )}
            </div>
          </div>
          <p className="mt-5 max-w-lg text-base italic text-[color:var(--ink-muted)]">
            No forms, no quizzes. Just say the word and Spotz finds the moves.
          </p>
        </div>
      </HandDrawnCard>
    </main>
  );
}
