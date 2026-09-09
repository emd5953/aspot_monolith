import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { resolveShareCode, getVoteCounts } from '@/lib/itinerary/share-service';
import { getItinerary } from '@/lib/ai/itinerary-generator';
import { redirect } from 'next/navigation';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { ItineraryView } from '@/components/itinerary/itinerary-view';
import { VoteChips } from '@/components/itinerary/vote-chips';

/**
 * /s/[code] — a shared itinerary, read-only (plus voting). Any signed-in
 * friend with the link can see the plan and vote on each stop. Not signed
 * in? The landing page handles sign-in, so we punt them there.
 */

export default async function SharedItineraryPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Keep the destination: this is the primary entry point for the share flow,
  // and dropping the code stranded friends on the landing page after sign-in.
  if (!user) redirect(`/?next=${encodeURIComponent(`/s/${code}`)}`);

  // Service client for the data: the share code is the capability, and RLS
  // grants no blanket shared-read (migration 019).
  const db = createServiceClient();

  const itineraryId = await resolveShareCode(db, code);
  if (!itineraryId) {
    return <DeadLink />;
  }

  const itinerary = await getItinerary(db, itineraryId);
  if (!itinerary) {
    return <DeadLink />;
  }

  const planIds = itinerary.days.flatMap((d) => d.activities.map((a) => a.id));
  const votes = await getVoteCounts(db, planIds, user.id);

  // Whose moves are these? Best-effort display name — RLS may keep it hidden
  // from a non-owner, in which case "A friend" does the job.
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', itinerary.userId)
    .maybeSingle();
  const ownerName = ownerProfile?.display_name || 'A friend';

  const votesByActivity = new Map(votes.map((v) => [v.planId, v]));

  return (
    <main className="relative mx-auto max-w-4xl px-4 pt-16 pb-24 md:px-6">
      {/* Share banner */}
      <div className="mb-1.5">
        <HandDrawnCard className="animate-fade-up flex flex-wrap items-center gap-2 p-4">
          <span className="text-xl" aria-hidden>
            📬
          </span>
          <p className="text-sm font-medium text-[color:var(--ink)]">
            <span className="font-heading text-base">{ownerName}</span> shared
            their moves — vote it up
          </p>
        </HandDrawnCard>
      </div>

      {/* Read-only plan: no handler props = no edit/regenerate/share affordances */}
      <ItineraryView
        itinerary={{
          ...itinerary,
          startDate: new Date(itinerary.startDate),
          endDate: new Date(itinerary.endDate),
          days: itinerary.days.map((d) => ({
            ...d,
            date: new Date(d.date),
          })),
        }}
      />

      {/* Vote chips per plan */}
      <div className="mt-1.5">
        <HandDrawnCard className="animate-fade-up p-4">
          <p className="text-xs font-medium text-[color:var(--ink-muted)]">
            How the moves are landing — tap a chip to vote:
          </p>
          <ul className="mt-2 space-y-1">
            {itinerary.days.flatMap((d) =>
              d.activities.map((a) => {
                const v = votesByActivity.get(a.id);
                return (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 truncate text-[color:var(--ink-soft)]">
                      {a.title}
                    </span>
                    <VoteChips
                      planId={a.id}
                      initialUp={v?.up ?? 0}
                      initialDown={v?.down ?? 0}
                      myVote={v?.mine ?? 0}
                    />
                  </li>
                );
              })
            )}
          </ul>
        </HandDrawnCard>
      </div>
    </main>
  );
}

/** The link points nowhere. Say so, in Spotz's own handwriting. */
function DeadLink() {
  return (
    <main className="relative mx-auto max-w-xl px-4 pt-32 pb-24 md:px-6">
      <HandDrawnCard className="animate-fade-up p-10 text-center">
        <p className="text-4xl" aria-hidden>
          💀
        </p>
        <h1 className="mt-4 font-heading text-3xl text-[color:var(--ink)] sm:text-4xl">
          This link is dead
        </h1>
        <p className="mt-3 text-sm text-[color:var(--ink-muted)]">
          Somebody moved the furniture. Ask for a new one — fresh links, zero
          drama.
        </p>
      </HandDrawnCard>
    </main>
  );
}
