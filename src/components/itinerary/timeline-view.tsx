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

export function TimelineView({ activities }: TimelineViewProps) {
  const categoryEmojis: Record<string, string> = {
    attraction: '🏛️',
    dining: '🍽️',
    breakfast: '🥐',
    lunch: '🍱',
    dinner: '🍷',
    activity: '🎯',
    transport: '🚗',
    museum: '🖼️',
    shopping: '🛍️',
    entertainment: '🎭',
    nightlife: '🌃',
    nature: '🌲',
    beach: '🏖️',
    sports: '⚽',
  };

  const categoryColors: Record<string, string> = {
    breakfast: 'bg-yellow-100 border-yellow-400',
    lunch: 'bg-orange-100 border-orange-400',
    dinner: 'bg-red-100 border-red-400',
    attraction: 'bg-blue-100 border-blue-400',
    museum: 'bg-purple-100 border-purple-400',
    shopping: 'bg-pink-100 border-pink-400',
    activity: 'bg-green-100 border-green-400',
    nature: 'bg-emerald-100 border-emerald-400',
    beach: 'bg-cyan-100 border-cyan-400',
  };

  // Filter activities with times
  const scheduledActivities = activities.filter(a => a.startTime && a.endTime);

  if (scheduledActivities.length === 0) {
    return (
      <div className="text-center text-foreground/60 py-8 font-body">
        No scheduled activities with times
      </div>
    );
  }

  // Calculate time position (percentage of day)
  const getTimePosition = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    // Day from 6am (360 min) to 11pm (1380 min) = 1020 min range
    const dayStart = 6 * 60; // 6am
    const dayEnd = 23 * 60; // 11pm
    const dayRange = dayEnd - dayStart;
    return ((totalMinutes - dayStart) / dayRange) * 100;
  };

  const getDuration = (start: string, end: string): number => {
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    return (endHour * 60 + endMin) - (startHour * 60 + startMin);
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  };

  return (
    <div className="relative">
      {/* Time axis */}
      <div className="flex justify-between text-xs text-foreground/40 mb-2 font-body">
        <span>6 AM</span>
        <span>9 AM</span>
        <span>12 PM</span>
        <span>3 PM</span>
        <span>6 PM</span>
        <span>9 PM</span>
        <span>11 PM</span>
      </div>

      {/* Timeline bar */}
      <div className="relative h-2 bg-foreground/10 rounded-full mb-6">
        {/* Hour markers */}
        {[6, 9, 12, 15, 18, 21].map((hour) => {
          const position = ((hour - 6) / 17) * 100;
          return (
            <div
              key={hour}
              className="absolute top-0 bottom-0 w-px bg-foreground/20"
              style={{ left: `${position}%` }}
            />
          );
        })}
      </div>

      {/* Activities */}
      <div className="space-y-3">
        {scheduledActivities.map((activity, index) => {
          const startPos = getTimePosition(activity.startTime!);
          const duration = getDuration(activity.startTime!, activity.endTime!);
          const emoji = categoryEmojis[activity.category] || '📍';
          const colorClass = categoryColors[activity.category] || 'bg-gray-100 border-gray-400';

          return (
            <div key={activity.id} className="relative">
              {/* Time indicator line */}
              <div className="relative h-16">
                <div
                  className={`absolute top-0 h-full border-l-4 ${colorClass} rounded-l-lg`}
                  style={{ left: `${startPos}%` }}
                >
                  <div className="absolute left-0 top-0 w-3 h-3 rounded-full bg-current -ml-2" />
                </div>

                {/* Activity card */}
                <div
                  className={`absolute top-0 h-full border-2 ${colorClass} rounded-lg p-2 shadow-sm hover:shadow-md transition-shadow`}
                  style={{
                    left: `${startPos}%`,
                    width: `${Math.max((duration / (17 * 60)) * 100, 15)}%`,
                  }}
                >
                  <div className="flex items-start gap-2 h-full">
                    <span className="text-lg flex-shrink-0">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-heading text-sm text-foreground truncate">
                        {activity.title}
                      </div>
                      <div className="text-xs text-foreground/60 font-body">
                        {activity.startTime} - {activity.endTime}
                        <span className="ml-1 text-foreground/40">
                          ({formatDuration(duration)})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gap indicator */}
              {index < scheduledActivities.length - 1 && (
                <div className="flex items-center gap-2 my-1 ml-4">
                  <div className="flex-1 border-t border-dashed border-foreground/20" />
                  <span className="text-xs text-foreground/40 font-body">
                    ⏱️ Travel time
                  </span>
                  <div className="flex-1 border-t border-dashed border-foreground/20" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-4 border-t-2 border-dashed border-foreground/20">
        <div className="flex items-center justify-between text-sm font-body">
          <span className="text-foreground/60">
            Total activities: {scheduledActivities.length}
          </span>
          <span className="text-foreground/60">
            Total time: {formatDuration(
              scheduledActivities.reduce((sum, a) => 
                sum + getDuration(a.startTime!, a.endTime!), 0
              )
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
