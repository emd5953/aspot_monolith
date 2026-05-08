'use client';

interface Activity {
  id: string;
  title: string;
  description: string;
  locationName?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  category: string;
  estimatedCost?: number;
  sortOrder: number;
  notes?: string;
}

interface TimelineViewProps {
  activities: Activity[];
}

const CATEGORY_TONES: Record<string, string> = {
  breakfast: 'from-amber-200 to-amber-50 border-amber-300 text-amber-900',
  lunch: 'from-orange-200 to-orange-50 border-orange-300 text-orange-900',
  dinner: 'from-rose-200 to-rose-50 border-rose-300 text-rose-900',
  dining: 'from-rose-200 to-rose-50 border-rose-300 text-rose-900',
  attraction: 'from-sky-200 to-sky-50 border-sky-300 text-sky-900',
  museum: 'from-violet-200 to-violet-50 border-violet-300 text-violet-900',
  shopping: 'from-pink-200 to-pink-50 border-pink-300 text-pink-900',
  activity: 'from-emerald-200 to-emerald-50 border-emerald-300 text-emerald-900',
  nature: 'from-teal-200 to-teal-50 border-teal-300 text-teal-900',
  beach: 'from-cyan-200 to-cyan-50 border-cyan-300 text-cyan-900',
  nightlife: 'from-indigo-200 to-indigo-50 border-indigo-300 text-indigo-900',
  entertainment: 'from-fuchsia-200 to-fuchsia-50 border-fuchsia-300 text-fuchsia-900',
  transport: 'from-slate-200 to-slate-50 border-slate-300 text-slate-900',
};

export function TimelineView({ activities }: TimelineViewProps) {
  const scheduled = activities.filter((a) => a.startTime && a.endTime);

  if (scheduled.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-[color:var(--ink-muted)]">
        No scheduled activities with times
      </div>
    );
  }

  const getTimePosition = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    const dayStart = 6 * 60;
    const dayEnd = 23 * 60;
    return ((totalMinutes - dayStart) / (dayEnd - dayStart)) * 100;
  };

  const getDuration = (start: string, end: string): number => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return eh * 60 + em - (sh * 60 + sm);
  };

  const formatDuration = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  return (
    <div className="relative">
      {/* Time axis */}
      <div className="mb-2 flex justify-between text-xs text-[color:var(--ink-soft)]">
        <span>6 AM</span>
        <span>9 AM</span>
        <span>12 PM</span>
        <span>3 PM</span>
        <span>6 PM</span>
        <span>9 PM</span>
        <span>11 PM</span>
      </div>

      {/* Timeline bar */}
      <div className="relative mb-6 h-1.5 rounded-full bg-[color:var(--surface-soft)]">
        {[6, 9, 12, 15, 18, 21].map((hour) => {
          const position = ((hour - 6) / 17) * 100;
          return (
            <div
              key={hour}
              className="absolute top-0 bottom-0 w-px bg-[color:var(--border)]"
              style={{ left: `${position}%` }}
            />
          );
        })}
      </div>

      {/* Activities */}
      <div className="space-y-3">
        {scheduled.map((activity, index) => {
          const startPos = getTimePosition(activity.startTime!);
          const duration = getDuration(activity.startTime!, activity.endTime!);
          const tone = CATEGORY_TONES[activity.category] || CATEGORY_TONES.activity;

          return (
            <div key={activity.id} className="relative">
              <div className="relative h-16">
                <div
                  className={`absolute top-0 h-full rounded-xl border bg-gradient-to-br p-2 ${tone}`}
                  style={{
                    left: `${startPos}%`,
                    width: `${Math.max((duration / (17 * 60)) * 100, 15)}%`,
                  }}
                >
                  <div className="flex h-full items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-heading text-sm">{activity.title}</div>
                      <div className="text-[11px] opacity-80">
                        {activity.startTime} – {activity.endTime}
                        <span className="ml-1 opacity-70">({formatDuration(duration)})</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {index < scheduled.length - 1 && (
                <div className="my-1 ml-4 flex items-center gap-2">
                  <div className="flex-1 border-t border-dashed border-[color:var(--border)]" />
                  <span className="text-[10px] font-medium text-[color:var(--ink-soft)]">
                    Travel
                  </span>
                  <div className="flex-1 border-t border-dashed border-[color:var(--border)]" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 border-t border-[color:var(--border)] pt-4">
        <div className="flex items-center justify-between text-xs text-[color:var(--ink-muted)]">
          <span>{scheduled.length} scheduled activities</span>
          <span>
            Total:{' '}
            {formatDuration(
              scheduled.reduce((sum, a) => sum + getDuration(a.startTime!, a.endTime!), 0)
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
