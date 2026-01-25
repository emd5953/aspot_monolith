'use client';

import { useState } from 'react';
import { DaySchedule } from './day-schedule';

interface Activity {
  id: string;
  title: string;
  description: string;
  locationName?: string;
  startTime?: string;
  endTime?: string;
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
}

export function ItineraryView({
  itinerary,
  onEditActivity,
  onDeleteActivity,
  onAddActivity,
  onReorderActivities,
  onRegenerate,
}: ItineraryViewProps) {
  const [activeTab, setActiveTab] = useState(0);

  const formatDateRange = (start: Date, end: Date) => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    completed: 'bg-blue-100 text-blue-800',
    archived: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{itinerary.title}</h1>
            <p className="text-gray-500 mt-1">
              {itinerary.destination} • {formatDateRange(itinerary.startDate, itinerary.endDate)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm ${statusColors[itinerary.status]}`}>
              {itinerary.status}
            </span>
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Regenerate
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Day Tabs */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="border-b">
          <div className="flex overflow-x-auto">
            {itinerary.days.map((day, index) => (
              <button
                key={day.id}
                onClick={() => setActiveTab(index)}
                className={`px-6 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === index
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
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
            />
          )}
        </div>
      </div>
    </div>
  );
}
