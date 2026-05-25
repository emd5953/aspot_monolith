import { getResendClient } from './resend';
import {
  buildItineraryEmailHtml,
  buildItineraryEmailSubject,
} from './itinerary-email';

interface Activity {
  title: string;
  locationName?: string;
  startTime?: string;
  endTime?: string;
  category: string;
}

interface Day {
  dayNumber: number;
  date: Date | string;
  activities: Activity[];
}

interface SendItineraryEmailInput {
  to: string; // recipient email
  itineraryId: string;
  title: string;
  destination: string;
  startDate: Date | string;
  endDate: Date | string;
  days: Day[];
}

/**
 * Send the completed itinerary to the user's email via Resend.
 * Fails silently if Resend isn't configured (dev without API key).
 */
export async function sendItineraryEmail(
  input: SendItineraryEmailInput
): Promise<{ success: boolean; error?: string }> {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, error: 'Email not configured' };
  }

  const formatDate = (d: Date | string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const formatDayDate = (d: Date | string) =>
    new Date(d).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'http://localhost:3000';

  const emailData = {
    title: input.title,
    destination: input.destination,
    startDate: formatDate(input.startDate),
    endDate: formatDate(input.endDate),
    days: input.days.map((day) => ({
      dayNumber: day.dayNumber,
      date: formatDayDate(day.date),
      activities: day.activities.map((act) => ({
        title: act.title,
        locationName: act.locationName,
        startTime: act.startTime,
        endTime: act.endTime,
        category: act.category,
      })),
    })),
    viewUrl: `${baseUrl}/itinerary/${input.itineraryId}`,
  };

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'aSpot <onboarding@resend.dev>',
      to: input.to,
      subject: buildItineraryEmailSubject(emailData),
      html: buildItineraryEmailHtml(emailData),
    });

    if (error) {
      console.error('[email] Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log(`[email] ✓ Itinerary email sent to ${input.to}`);
    return { success: true };
  } catch (err) {
    console.error('[email] Failed to send:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
