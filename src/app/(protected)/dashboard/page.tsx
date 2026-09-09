import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ItinerarySearch } from '@/components/itinerary/itinerary-search';

/**
 * The arrival screen: one greeting, one input. Everything that used to sit
 * here — the brand label the nav already carries, the subhead restating the
 * placeholder, the floating history hint — was read-once copy standing between
 * the user and the only control on the page. History lives in the "Moves" tab,
 * which is where people look for it.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single();

  const firstName = profile?.display_name?.split(' ')[0];

  return (
    <main className="fixed inset-0 z-10 mx-auto flex flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="flex w-full max-w-xl flex-col items-center">
        <h1 className="animate-fade-up font-heading text-4xl leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl">
          Yurrrrr{firstName ? `, ${firstName}` : ''}.
          <br />
          What&apos;s the word?
        </h1>

        <div className="animate-fade-up mt-8 w-full" style={{ animationDelay: '0.15s' }}>
          <ItinerarySearch tone="cinematic" />
        </div>
      </div>
    </main>
  );
}
