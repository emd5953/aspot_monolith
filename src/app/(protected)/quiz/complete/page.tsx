import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getUserPreferences } from '@/lib/quiz/profile-generator';
import { clearProgress } from '@/lib/quiz/progress-service';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { CheckCircle } from 'lucide-react';

export default async function QuizCompletePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const preferences = await getUserPreferences(supabase, user.id);

  if (!preferences) {
    redirect('/quiz');
  }

  // Clear quiz progress since it's complete
  await clearProgress(supabase, user.id);

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <HandDrawnCard decoration="tack" className="p-8 text-center">
          <div 
            className="w-20 h-20 border-wobbly-sm border-[3px] border-foreground bg-post-it flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="w-10 h-10 text-foreground" strokeWidth={2.5} />
          </div>

          <h1 className="text-4xl md:text-5xl font-heading text-foreground mb-4">
            Your travel profile is ready
            <span className="inline-block rotate-12 text-accent ml-2">!</span>
          </h1>
          <p className="text-xl text-foreground/80 mb-8 font-body">
            We&apos;ve saved your preferences and you&apos;re all set to create personalized itineraries.
          </p>

          <HandDrawnCard variant="post-it" className="p-6 mb-8 text-left">
            <h2 className="text-2xl font-heading text-foreground mb-4">Your preferences:</h2>
            <div className="space-y-3 text-lg font-body">
              <div>
                <span className="text-foreground/70">Budget:</span>{' '}
                <span className="font-heading capitalize">{preferences.budgetRange}</span>
              </div>
              <div>
                <span className="text-foreground/70">Travel pace:</span>{' '}
                <span className="font-heading capitalize">{preferences.travelPace}</span>
              </div>
              <div>
                <span className="text-foreground/70">Accommodation:</span>{' '}
                <span className="font-heading capitalize">{preferences.accommodationStyle}</span>
              </div>
              <div>
                <span className="text-foreground/70">Adventure level:</span>{' '}
                <span className="font-heading">{preferences.adventureTolerance}/10</span>
              </div>
              {preferences.cuisinePreferences.length > 0 && (
                <div>
                  <span className="text-foreground/70">Cuisines:</span>{' '}
                  <span className="font-heading capitalize">
                    {preferences.cuisinePreferences.join(', ')}
                  </span>
                </div>
              )}
              {preferences.activityTypes.length > 0 && (
                <div>
                  <span className="text-foreground/70">Activities:</span>{' '}
                  <span className="font-heading capitalize">
                    {preferences.activityTypes.join(', ')}
                  </span>
                </div>
              )}
            </div>
          </HandDrawnCard>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard">
              <HandDrawnButton variant="accent" size="lg">
                Go to Dashboard
              </HandDrawnButton>
            </Link>
            <Link href="/quiz">
              <HandDrawnButton variant="secondary" size="lg">
                Retake Quiz
              </HandDrawnButton>
            </Link>
          </div>
        </HandDrawnCard>
      </div>
    </div>
  );
}
