import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Lightbulb, ClipboardList, Users } from 'lucide-react';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';

// Force dynamic rendering - don't cache this page
export const dynamic = 'force-dynamic';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If logged in, redirect to dashboard
  if (user) {
    redirect('/dashboard');
  }

  // Landing page for non-logged-in users
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="bg-card border-b-4 border-dashed border-foreground">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl md:text-4xl font-heading text-foreground -rotate-1">
              ✈️ AI Itinerary Planner
            </h1>
            <div className="flex gap-3">
              <Link href="/login">
                <HandDrawnButton variant="secondary" size="sm">
                  Log In
                </HandDrawnButton>
              </Link>
              <Link href="/signup">
                <HandDrawnButton variant="accent" size="sm">
                  Sign Up
                </HandDrawnButton>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-5xl md:text-6xl font-heading text-foreground mb-6 leading-tight">
            Plan Your Perfect Trip
            <span className="inline-block rotate-12 text-accent ml-2">!</span>
          </h2>
          <p className="text-xl md:text-2xl text-foreground/80 mb-8 max-w-3xl mx-auto leading-relaxed">
            Multi-agent AI system that researches destinations, creates personalized itineraries, 
            and helps you collaborate with friends on group trips.
          </p>
          
          {/* Hand-drawn arrow decoration (desktop only) */}
          <div className="hidden md:block absolute left-1/2 ml-32 mt-4">
            <svg width="120" height="60" viewBox="0 0 120 60" className="rotate-12">
              <path
                d="M 10 30 Q 40 10, 70 25 T 110 20"
                stroke="#2d2d2d"
                strokeWidth="2"
                fill="none"
                strokeDasharray="5,5"
              />
              <path
                d="M 110 20 L 100 15 M 110 20 L 105 28"
                stroke="#2d2d2d"
                strokeWidth="2"
                fill="none"
              />
            </svg>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12">
            <Link href="/signup">
              <HandDrawnButton variant="accent" size="lg">
                Get Started Free
              </HandDrawnButton>
            </Link>
            <Link href="/login">
              <HandDrawnButton variant="primary" size="lg">
                Log In
              </HandDrawnButton>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-20 grid md:grid-cols-3 gap-8">
          <HandDrawnCard decoration="tape" className="hover:rotate-1 transition-transform">
            <div 
              className="w-16 h-16 border-wobbly-sm border-[3px] border-foreground flex items-center justify-center mb-4 bg-post-it"
            >
              <Lightbulb className="w-8 h-8 text-foreground" strokeWidth={2.5} />
            </div>
            <h3 className="text-2xl font-heading mb-3 text-foreground">AI-Powered Research</h3>
            <p className="text-lg text-foreground/80 leading-relaxed">
              Our agents scrape TripAdvisor, Yelp, Reddit, and more to find the best attractions and restaurants.
            </p>
          </HandDrawnCard>

          <HandDrawnCard decoration="tack" className="hover:-rotate-1 transition-transform">
            <div 
              className="w-16 h-16 border-wobbly-sm border-[3px] border-foreground flex items-center justify-center mb-4 bg-muted"
            >
              <ClipboardList className="w-8 h-8 text-foreground" strokeWidth={2.5} />
            </div>
            <h3 className="text-2xl font-heading mb-3 text-foreground">Personalized Itineraries</h3>
            <p className="text-lg text-foreground/80 leading-relaxed">
              Take a quick quiz and get day-by-day plans tailored to your interests, budget, and travel style.
            </p>
          </HandDrawnCard>

          <HandDrawnCard decoration="tape" className="hover:rotate-1 transition-transform">
            <div 
              className="w-16 h-16 border-wobbly-sm border-[3px] border-foreground flex items-center justify-center mb-4 bg-card"
            >
              <Users className="w-8 h-8 text-foreground" strokeWidth={2.5} />
            </div>
            <h3 className="text-2xl font-heading mb-3 text-foreground">Collaborative Planning</h3>
            <p className="text-lg text-foreground/80 leading-relaxed">
              Invite friends, share suggestions, vote on activities, and plan group trips together.
            </p>
          </HandDrawnCard>
        </div>

        {/* Decorative bouncing element */}
        <div className="hidden md:block absolute right-20 top-1/2 animate-gentle-bounce">
          <div 
            className="w-24 h-24 border-dashed border-4 border-accent"
            style={{ borderRadius: '155px 25px 145px 25px / 25px 145px 25px 155px' }}
          />
        </div>
      </main>
    </div>
  );
}
