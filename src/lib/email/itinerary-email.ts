/**
 * Generates the HTML email body for a completed itinerary.
 * Clean, minimal design — reads like a travel receipt, not a newsletter.
 */

interface EmailActivity {
  title: string;
  locationName?: string;
  startTime?: string;
  endTime?: string;
  category: string;
}

interface EmailDay {
  dayNumber: number;
  date: string; // formatted like "Monday, May 26"
  activities: EmailActivity[];
}

interface ItineraryEmailData {
  title: string;
  destination: string;
  startDate: string; // formatted like "May 25"
  endDate: string;
  days: EmailDay[];
  viewUrl: string; // full URL to the itinerary in the app
}

/**
 * Escape a value for safe interpolation into HTML. Itinerary titles,
 * destinations, and activity names are user/AI-generated, so a stray `<`, `&`,
 * or `"` would otherwise break the email layout or inject markup. Covers both
 * element-text and double-quoted-attribute contexts (used for the view URL).
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildItineraryEmailSubject(data: ItineraryEmailData): string {
  // Plain-text subject line — not HTML, so no escaping (would show &amp;).
  return `Your trip to ${data.destination} is ready ✈️`;
}

export function buildItineraryEmailHtml(data: ItineraryEmailData): string {
  const daysHtml = data.days
    .map(
      (day) => `
      <tr>
        <td style="padding: 24px 0 8px 0;">
          <p style="margin: 0; font-size: 12px; color: #5a6a85; font-weight: 600;">Day ${day.dayNumber}</p>
          <p style="margin: 4px 0 0 0; font-size: 20px; color: #0b1e3c; font-family: Georgia, serif;">${escapeHtml(day.date)}</p>
        </td>
      </tr>
      ${day.activities
        .map(
          (act) => `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #f0f4f8;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="vertical-align: top; width: 60px;">
                <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; background: #f0f4f8; font-size: 11px; color: #5a6a85; text-transform: capitalize;">${escapeHtml(act.category)}</span>
              </td>
              <td style="vertical-align: top; padding-left: 12px;">
                <p style="margin: 0; font-size: 15px; color: #0b1e3c; font-weight: 500;">${escapeHtml(act.title)}</p>
                ${act.locationName && act.locationName !== act.title ? `<p style="margin: 2px 0 0 0; font-size: 13px; color: #5a6a85;">📍 ${escapeHtml(act.locationName)}</p>` : ''}
                ${act.startTime && act.endTime ? `<p style="margin: 2px 0 0 0; font-size: 12px; color: #8a97af;">🕐 ${escapeHtml(act.startTime)} – ${escapeHtml(act.endTime)}</p>` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>`
        )
        .join('')}
    `
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(data.title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6faff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f6faff;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 560px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px -12px rgba(20,50,100,0.12);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; background: linear-gradient(135deg, #e8f1fb 0%, #ffffff 100%);">
              <p style="margin: 0; font-size: 13px; color: #5a6a85;">aSpot · Your itinerary is ready</p>
              <h1 style="margin: 12px 0 0 0; font-size: 28px; color: #0b1e3c; font-family: Georgia, serif; font-weight: normal; line-height: 1.2;">${escapeHtml(data.title)}</h1>
              <p style="margin: 12px 0 0 0; font-size: 14px; color: #5a6a85;">
                📍 ${escapeHtml(data.destination)} &nbsp;·&nbsp; 📅 ${escapeHtml(data.startDate)} – ${escapeHtml(data.endDate)}
              </p>
            </td>
          </tr>

          <!-- Days -->
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                ${daysHtml}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 0 32px 32px 32px;" align="center">
              <a href="${escapeHtml(data.viewUrl)}" style="display: inline-block; padding: 14px 28px; background: #0b1e3c; color: #ffffff; text-decoration: none; border-radius: 999px; font-size: 14px; font-weight: 600;">View full itinerary →</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background: #f6faff; border-top: 1px solid #e8f1fb;">
              <p style="margin: 0; font-size: 12px; color: #8a97af; text-align: center;">
                Built by <a href="https://aspot.app" style="color: #2f6fd8; text-decoration: none;">aSpot</a> · Your pocket travel buddy
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
