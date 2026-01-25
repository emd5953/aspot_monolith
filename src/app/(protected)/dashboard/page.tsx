import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from '@/components/auth/logout-button';

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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-bold text-gray-900">AI Itinerary Planner</h1>
              <div className="hidden md:flex items-center gap-4">
                <Link href="/itinerary" className="text-gray-600 hover:text-gray-900">
                  My Itineraries
                </Link>
                <Link href="/profile" className="text-gray-600 hover:text-gray-900">
                  Profile
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-700">
                Welcome, {profile?.display_name || user.email}
              </span>
              <LogoutButton />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Quiz Card */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${hasCompletedQuiz ? 'bg-green-100' : 'bg-blue-100'}`}>
                  {hasCompletedQuiz ? (
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Travel Preferences Quiz</h3>
                  <p className="text-sm text-gray-500">
                    {hasCompletedQuiz ? 'Completed' : 'Tell us about your travel style'}
                  </p>
                </div>
              </div>
              <Link
                href="/quiz"
                className={`block w-full text-center py-2 rounded-lg font-medium transition-colors ${
                  hasCompletedQuiz
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {hasCompletedQuiz ? 'Retake Quiz' : 'Start Quiz'}
              </Link>
            </div>

            {/* Itinerary Card */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">My Itineraries</h3>
                  <p className="text-sm text-gray-500">View and manage your trips</p>
                </div>
              </div>
              <Link
                href="/itinerary"
                className="block w-full text-center py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
              >
                View Itineraries
              </Link>
            </div>
          </div>

          {!hasCompletedQuiz && (
            <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h4 className="font-medium text-yellow-800">Complete your profile</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Take the travel preferences quiz to get personalized AI-generated itineraries tailored to your interests.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
