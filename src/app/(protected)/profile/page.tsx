import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Four elements: avatar, name, handle, and the sign-out in the nav. The
 * "Your Spotz card" label and the italic "No forms, no quizzes" line described
 * a page that has no forms to describe.
 */
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
    <main className="mx-auto max-w-3xl px-5 pt-10 pb-24 md:px-6">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] font-heading text-3xl text-[color:var(--ink)]">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-heading text-3xl leading-tight text-[color:var(--ink)]">
            {displayName}
          </h1>
          {profile?.username && (
            <p className="text-sm text-[color:var(--ink-muted)]">@{profile.username}</p>
          )}
        </div>
      </div>
    </main>
  );
}
