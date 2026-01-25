import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from '@/components/auth/logout-button';
import { ClipboardList, Map, CheckCircle, AlertCircle } from 'lucide-react';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';
import { ItinerarySearch } from '@/components/itinerary/itinerary-search';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const { data: preferences } = await supabase
    .from('user_preferences')
    .select('id')
    .eq('user_id', user.id)
    .single();

  const hasCompletedQuiz = !!preferences;

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="bg-card border-b-4 border-dashed border-foreground">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-8">
              <Link href="/dashboard">
                <h1 className="text-2xl md:text-3xl font-heading text-foreground -rotate-1">
                  ✈️ aSpot - AI Itinerary Planner
                </h1>
              </Link>
              <div className="hidden md:flex items-center gap-4">
                <Link href="/itinerary">
                  <HandDrawnButton variant="secondary" size="sm">
                    My Itineraries
                  </HandDrawnButton>
                </Link>
                <Link href="/profile">
                  <HandDrawnButton variant="secondary" size="sm">
                    Profile
                  </HandDrawnButton>
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="hidden sm:block text-foreground text-lg font-body">
                {profile?.display_name || user.email}
              </span>
              <LogoutButton />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto py-12 px-6">
        <div className="mb-12 text-center">
          <h2 className="text-4xl md:text-5xl font-heading text-foreground mb-4">
            Welcome back{profile?.display_name ? `, ${profile.display_name}` : ''}
            <span className="inline-block rotate-12 text-accent ml-2">!</span>
          </h2>
          <p className="text-xl text-foreground/80">
            Ready to plan your next adventure?
          </p>
        </div>

        {/* Itinerary Search/Generate */}
        <div className="mb-8">
          <ItinerarySearch />
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Quiz Card */}
          <HandDrawnCard 
            decoration={hasCompletedQuiz ? "tack" : "tape"}
            className="hover:rotate-1 transition-transform"
          >
            <div className="flex items-center gap-4 mb-6">
              <div 
                className={`w-16 h-16 border-wobbly-sm border-[3px] border-foreground flex items-center justify-center ${
                  hasCompletedQuiz ? 'bg-post-it' : 'bg-muted'
                }`}
              >
                {hasCompletedQuiz ? (
                  <CheckCircle className="w-8 h-8 text-foreground" strokeWidth={2.5} />
                ) : (
                  <ClipboardList className="w-8 h-8 text-foreground" strokeWidth={2.5} />
                )}
              </div>
              <div>
                <h3 className="text-2xl font-heading text-foreground">Travel Preferences Quiz</h3>
                <p className="text-lg text-foreground/70">
                  {hasCompletedQuiz ? 'Completed ✓' : 'Tell us about your travel style'}
                </p>
              </div>
            </div>
            <Link href="/quiz">
              <HandDrawnButton
                variant={hasCompletedQuiz ? 'secondary' : 'accent'}
                className="w-full"
              >
                {hasCompletedQuiz ? 'Retake Quiz' : 'Start Quiz'}
              </HandDrawnButton>
            </Link>
          </HandDrawnCard>

          {/* Itinerary Card */}
          <HandDrawnCard 
            decoration="tape"
            className="hover:-rotate-1 transition-transform"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 border-wobbly-sm border-[3px] border-foreground flex items-center justify-center bg-card">
                <Map className="w-8 h-8 text-foreground" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-2xl font-heading text-foreground">My Itineraries</h3>
                <p className="text-lg text-foreground/70">View and manage your trips</p>
              </div>
            </div>
            <Link href="/itinerary">
              <HandDrawnButton variant="accent" className="w-full">
                View Itineraries
              </HandDrawnButton>
            </Link>
          </HandDrawnCard>
        </div>

        {/* Warning Banner */}
        {!hasCompletedQuiz && (
          <HandDrawnCard variant="post-it" className="mt-8">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-8 h-8 text-foreground flex-shrink-0 mt-1" strokeWidth={2.5} />
              <div>
                <h4 className="text-2xl font-heading text-foreground mb-2">Complete your profile</h4>
                <p className="text-lg text-foreground/80 leading-relaxed">
                  Take the travel preferences quiz to get personalized AI-generated itineraries tailored to your interests.
                </p>
              </div>
            </div>
          </HandDrawnCard>
        )}
      </main>
    </div>
  );
}
