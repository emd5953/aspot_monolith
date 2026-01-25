'use client';

import { useState } from 'react';
import { DaySchedule } from './day-schedule';
import { ItineraryMap } from './itinerary-map';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';

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

interface Day {
  id: string;
  dayNumber: number;
  date: Date;
  notes?: string;
  activities: Activity[];
}

interface Itinerary {
  id: string;
  title: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  status: string;
  days: Day[];
}

interface ItineraryViewProps {
  itinerary: Itinerary;
  onEditActivity?: (activity: Activity) => void;
  onDeleteActivity?: (activityId: string) => void;
  onAddActivity?: (dayId: string) => void;
  onReorderActivities?: (dayId: string, activityIds: string[]) => void;
  onRegenerate?: () => void;
  onDelete?: () => void;
  onStatusChange?: (status: string) => void;
  onEditDay?: (dayId: string, dayNumber: number, activities: Activity[]) => void;
}

export function ItineraryView({
  itinerary,
  onEditActivity,
  onDeleteActivity,
  onAddActivity,
  onReorderActivities,
  onRegenerate,
  onDelete,
  onStatusChange,
  onEditDay,
}: ItineraryViewProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const formatDateRange = (start: Date, end: Date) => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
  };

  const statusEmojis: Record<string, string> = {
    draft: '📝',
    active: '✈️',
    completed: '✅',
    archived: '📦',
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-post-it border-foreground',
    active: 'bg-secondary-accent/20 text-secondary-accent border-secondary-accent',
    completed: 'bg-accent/20 text-accent border-accent',
    archived: 'bg-muted border-foreground',
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <HandDrawnCard decoration="tape" className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-heading text-foreground -rotate-1">{itinerary.title}</h1>
            <p className="text-foreground/70 mt-2 font-body text-lg">
              📍 {itinerary.destination} • 📅 {formatDateRange(itinerary.startDate, itinerary.endDate)}
            </p>
            <p className="text-xs text-foreground/50 mt-1 font-body">
              ✓ Auto-saved • Click status to update
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className={`px-3 py-1 text-sm border-2 border-wobbly-sm font-body ${statusColors[itinerary.status]} hover:opacity-80 transition-opacity cursor-pointer`}
                title="Click to change status"
              >
                {statusEmojis[itinerary.status]} {itinerary.status} ▼
              </button>
              {showStatusMenu && (
                <div className="absolute top-full right-0 mt-2 bg-card border-2 border-foreground shadow-hand z-10 min-w-[150px]">
                  {(['draft', 'active', 'completed', 'archived'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => {
                        onStatusChange?.(status);
                        setShowStatusMenu(false);
                      }}
                      className={`w-full px-4 py-2 text-left font-body hover:bg-muted transition-colors flex items-center gap-2 ${
                        itinerary.status === status ? 'bg-accent/10' : ''
                      }`}
                    >
                      {statusEmojis[status]} {status}
                      {itinerary.status === status && <span className="ml-auto">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {onRegenerate && (
              <HandDrawnButton
                onClick={onRegenerate}
                variant="accent"
                size="sm"
              >
                🔄 Regenerate
              </HandDrawnButton>
            )}
            {onDelete && (
              <HandDrawnButton
                onClick={onDelete}
                variant="secondary"
                size="sm"
              >
                🗑️ Delete
              </HandDrawnButton>
            )}
          </div>
        </div>
      </HandDrawnCard>

      {/* Map View */}
      <HandDrawnCard decoration="tack" className="p-6">
        <h2 className="text-2xl font-heading text-foreground mb-4 -rotate-1">🗺️ Route Map</h2>
        <ItineraryMap
          destination={itinerary.destination}
          activities={itinerary.days.flatMap(day => day.activities)}
        />
      </HandDrawnCard>

      {/* Day Tabs */}
      <HandDrawnCard className="overflow-hidden">
        <div className="border-b-2 border-foreground border-dashed">
          <div className="flex overflow-x-auto">
            {itinerary.days.map((day, index) => (
              <button
                key={day.id}
                onClick={() => setActiveTab(index)}
                className={`px-6 py-3 font-body text-base whitespace-nowrap border-b-4 transition-all ${
                  activeTab === index
                    ? 'border-accent text-accent bg-accent/10 -rotate-1'
                    : 'border-transparent text-foreground/60 hover:text-foreground hover:bg-muted/50'
                }`}
              >
                Day {day.dayNumber}
              </button>
            ))}
          </div>
        </div>

        {/* Active Day Content */}
        <div className="p-6">
          {itinerary.days[activeTab] && (
            <DaySchedule
              dayNumber={itinerary.days[activeTab].dayNumber}
              date={itinerary.days[activeTab].date}
              activities={itinerary.days[activeTab].activities}
              notes={itinerary.days[activeTab].notes}
              onEditActivity={onEditActivity}
              onDeleteActivity={onDeleteActivity}
              onAddActivity={onAddActivity ? () => onAddActivity(itinerary.days[activeTab].id) : undefined}
              onReorder={onReorderActivities ? (ids) => onReorderActivities(itinerary.days[activeTab].id, ids) : undefined}
              onEditDay={onEditDay ? () => onEditDay(
                itinerary.days[activeTab].id,
                itinerary.days[activeTab].dayNumber,
                itinerary.days[activeTab].activities
              ) : undefined}
            />
          )}
        </div>
      </HandDrawnCard>
    </div>
  );
}
