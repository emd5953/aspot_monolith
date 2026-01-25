import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-gray-900">AI Itinerary Planner</h1>
            <div className="flex gap-4">
              <Link
                href="/login"
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Log In
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            Plan Your Perfect Trip with AI
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Multi-agent AI system that researches destinations, creates personalized itineraries, 
            and helps you collaborate with friends on group trips.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/signup"
              className="px-8 py-3 bg-blue-600 text-white text-lg rounded-lg hover:bg-blue-700 transition-colors"
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="px-8 py-3 border-2 border-gray-300 text-gray-700 text-lg rounded-lg hover:border-gray-400 transition-colors"
            >
              Log In
            </Link>
          </div>
        </div>

        <div className="mt-20 grid md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">AI-Powered Research</h3>
            <p className="text-gray-600">
              Our agents scrape TripAdvisor, Yelp, Reddit, and more to find the best attractions and restaurants.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Personalized Itineraries</h3>
            <p className="text-gray-600">
              Take a quick quiz and get day-by-day plans tailored to your interests, budget, and travel style.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Collaborative Planning</h3>
            <p className="text-gray-600">
              Invite friends, share suggestions, vote on activities, and plan group trips together.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
