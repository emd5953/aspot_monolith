import { describe, it, expect } from 'vitest';
import { escapeHtml, buildItineraryEmailHtml } from './itinerary-email';

/**
 * Regression guard for the audit find: itinerary titles / destinations /
 * activity names (all user- or AI-generated) were interpolated into the email
 * HTML unescaped, so a `<`, `&`, or `"` broke the layout or injected markup.
 */

describe('escapeHtml', () => {
  it('escapes the HTML-significant characters', () => {
    expect(escapeHtml(`<b>"Tom & Jerry's"</b>`)).toBe(
      '&lt;b&gt;&quot;Tom &amp; Jerry&#39;s&quot;&lt;/b&gt;'
    );
  });

  it('escapes ampersands once (no double-encoding)', () => {
    expect(escapeHtml('A & B & C')).toBe('A &amp; B &amp; C');
  });

  it('leaves safe text untouched', () => {
    expect(escapeHtml('2 nights in Lisbon')).toBe('2 nights in Lisbon');
  });
});

describe('buildItineraryEmailHtml', () => {
  const data = {
    title: `Tokyo <script>alert(1)</script>`,
    destination: 'Tokyo & Kyoto',
    startDate: 'May 25',
    endDate: 'May 28',
    viewUrl: 'https://aspot.app/itinerary/abc"onmouseover="x',
    days: [
      {
        dayNumber: 1,
        date: 'Monday, May 25',
        activities: [
          { title: 'Bar <Six>', locationName: 'A & B St', category: 'nightlife' },
        ],
      },
    ],
  };

  it('escapes injected markup from a malicious title', () => {
    const html = buildItineraryEmailHtml(data);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('Tokyo &lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes user/AI content in destination and activity fields', () => {
    const html = buildItineraryEmailHtml(data);
    expect(html).toContain('Tokyo &amp; Kyoto');
    expect(html).toContain('Bar &lt;Six&gt;');
    expect(html).toContain('A &amp; B St');
  });

  it('escapes the view URL so a quote cannot break out of the href attribute', () => {
    const html = buildItineraryEmailHtml(data);
    expect(html).not.toContain('abc"onmouseover="x');
    expect(html).toContain('abc&quot;onmouseover=&quot;x');
  });

  it('renders packing tips + important notes (escaped) when present', () => {
    const html = buildItineraryEmailHtml({
      ...data,
      packingTips: ['Umbrella & layers', 'Comfy shoes'],
      importantNotes: ['Cash-only <spots>'],
    });
    expect(html).toContain('Packing tips');
    expect(html).toContain('Umbrella &amp; layers');
    expect(html).toContain('Good to know');
    expect(html).toContain('Cash-only &lt;spots&gt;');
  });

  it('omits the before-you-go section entirely when there are no tips', () => {
    const html = buildItineraryEmailHtml(data); // no packingTips/importantNotes
    expect(html).not.toContain('Packing tips');
    expect(html).not.toContain('Good to know');
  });
});
