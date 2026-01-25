import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getUserPreferences } from '@/lib/quiz/profile-generator';
import { clearProgress } from '@/lib/quiz/progress-service';

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
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Your travel profile is ready!
          </h1>
          <p className="text-gray-600 mb-8">
            We&apos;ve saved your preferences and you&apos;re all set to create personalized itineraries.
          </p>

          <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
            <h2 className="font-semibold text-gray-900 mb-4">Your preferences:</h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-500">Budget:</span>{' '}
                <span className="font-medium capitalize">{preferences.budgetRange}</span>
              </div>
              <div>
                <span className="text-gray-500">Travel pace:</span>{' '}
                <span className="font-medium capitalize">{preferences.travelPace}</span>
              </div>
              <div>
                <span className="text-gray-500">Accommodation:</span>{' '}
                <span className="font-medium capitalize">{preferences.accommodationStyle}</span>
              </div>
              <div>
                <span className="text-gray-500">Adventure level:</span>{' '}
                <span className="font-medium">{preferences.adventureTolerance}/10</span>
              </div>
              {preferences.cuisinePreferences.length > 0 && (
                <div>
                  <span className="text-gray-500">Cuisines:</span>{' '}
                  <span className="font-medium capitalize">
                    {preferences.cuisinePreferences.join(', ')}
                  </span>
                </div>
              )}
              {preferences.activityTypes.length > 0 && (
                <div>
                  <span className="text-gray-500">Activities:</span>{' '}
                  <span className="font-medium capitalize">
                    {preferences.activityTypes.join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <Link
              href="/dashboard"
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Go to Dashboard
            </Link>
            <Link
              href="/quiz"
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Retake Quiz
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
