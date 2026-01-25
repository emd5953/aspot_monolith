'use client';

import { useState } from 'react';

interface Activity {
  id: string;
  title: string;
  description: string;
  locationName?: string;
  startTime?: string;
  endTime?: string;
  category: string;
  estimatedCost?: number;
  notes?: string;
}

interface ActivityCardProps {
  activity: Activity;
  onEdit?: (activity: Activity) => void;
  onDelete?: (activityId: string) => void;
  isDragging?: boolean;
}

export function ActivityCard({ activity, onEdit, onDelete, isDragging }: ActivityCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const categoryColors: Record<string, string> = {
    attraction: 'bg-blue-100 text-blue-800',
    dining: 'bg-orange-100 text-orange-800',
    activity: 'bg-green-100 text-green-800',
    transport: 'bg-purple-100 text-purple-800',
    accommodation: 'bg-pink-100 text-pink-800',
  };

  const categoryColor = categoryColors[activity.category] || 'bg-gray-100 text-gray-800';

  return (
    <div
      className={`bg-white rounded-lg border p-4 transition-shadow ${
        isDragging ? 'shadow-lg ring-2 ring-blue-500' : 'shadow-sm hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${categoryColor}`}>
              {activity.category}
            </span>
            {activity.startTime && activity.endTime && (
              <span className="text-xs text-gray-500">
                {activity.startTime} - {activity.endTime}
              </span>
            )}
          </div>
          <h4 className="font-medium text-gray-900">{activity.title}</h4>
          {activity.locationName && (
            <p className="text-sm text-gray-500 mt-1">{activity.locationName}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onEdit && (
            <button
              onClick={() => onEdit(activity)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(activity.id)}
              className="p-1.5 text-gray-400 hover:text-red-600 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
          >
            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t text-sm text-gray-600 space-y-2">
          {activity.description && <p>{activity.description}</p>}
          {activity.estimatedCost && (
            <p>Estimated cost: ${activity.estimatedCost}</p>
          )}
          {activity.notes && (
            <p className="italic text-gray-500">{activity.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}
