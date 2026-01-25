'use client';

import { useState } from 'react';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';

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
  bookingUrl?: string;
  sortOrder: number;
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

  const categoryEmojis: Record<string, string> = {
    attraction: '🏛️',
    dining: '🍽️',
    breakfast: '🥐',
    lunch: '🍱',
    dinner: '🍷',
    activity: '🎯',
    transport: '🚗',
    accommodation: '🏨',
    museum: '🖼️',
    shopping: '🛍️',
    entertainment: '🎭',
    nightlife: '🌃',
    nature: '🌲',
    beach: '🏖️',
    sports: '⚽',
  };

  const categoryColors: Record<string, string> = {
    attraction: 'bg-secondary-accent/20 text-secondary-accent border-secondary-accent',
    dining: 'bg-accent/20 text-accent border-accent',
    breakfast: 'bg-yellow-100 text-yellow-800 border-yellow-600',
    lunch: 'bg-orange-100 text-orange-800 border-orange-600',
    dinner: 'bg-red-100 text-red-800 border-red-600',
    activity: 'bg-post-it border-foreground',
    transport: 'bg-muted border-foreground',
    accommodation: 'bg-card border-foreground',
    museum: 'bg-purple-100 text-purple-800 border-purple-600',
    shopping: 'bg-pink-100 text-pink-800 border-pink-600',
    entertainment: 'bg-indigo-100 text-indigo-800 border-indigo-600',
    nightlife: 'bg-violet-100 text-violet-800 border-violet-600',
    nature: 'bg-green-100 text-green-800 border-green-600',
    beach: 'bg-cyan-100 text-cyan-800 border-cyan-600',
    sports: 'bg-blue-100 text-blue-800 border-blue-600',
  };

  const categoryColor = categoryColors[activity.category] || 'bg-muted border-foreground';
  const emoji = categoryEmojis[activity.category] || '📍';

  // Calculate duration display
  const getDurationDisplay = () => {
    if (!activity.startTime || !activity.endTime) return null;
    
    const start = activity.startTime;
    const end = activity.endTime;
    
    // Calculate duration in minutes
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    const durationMins = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    
    const hours = Math.floor(durationMins / 60);
    const mins = durationMins % 60;
    
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  };

  const durationDisplay = getDurationDisplay();

  return (
    <HandDrawnCard
      className={`p-4 transition-all ${
        isDragging ? 'shadow-hand-lg rotate-2 scale-105' : 'shadow-hand-sm hover:shadow-hand hover:-rotate-1'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-3 py-1 border-2 border-wobbly-sm font-body ${categoryColor}`}>
              {emoji} {activity.category}
            </span>
            {activity.startTime && activity.endTime && (
              <span className="text-xs text-foreground/60 font-body flex items-center gap-1">
                🕐 {activity.startTime} - {activity.endTime}
                {durationDisplay && <span className="text-foreground/40">({durationDisplay})</span>}
              </span>
            )}
          </div>
          <h4 className="font-heading text-lg text-foreground">{activity.title}</h4>
          {activity.locationName && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.locationName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-foreground/70 hover:text-secondary-accent mt-1 font-body inline-flex items-center gap-1 transition-colors cursor-pointer underline decoration-dotted underline-offset-2"
            >
              📍 {activity.locationName}
            </a>
          )}
          {activity.bookingUrl && (
            <a
              href={activity.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-accent hover:text-accent/80 mt-1 font-body inline-flex items-center gap-1 transition-colors cursor-pointer underline decoration-solid underline-offset-2 ml-3"
            >
              🎟️ Event Link
            </a>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onEdit && (
            <button
              onClick={() => onEdit(activity)}
              className="p-2 text-foreground/60 hover:text-secondary-accent hover:bg-secondary-accent/10 border-wobbly-sm transition-colors"
              title="Edit"
            >
              ✏️
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(activity.id)}
              className="p-2 text-foreground/60 hover:text-accent hover:bg-accent/10 border-wobbly-sm transition-colors"
              title="Delete"
            >
              🗑️
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-foreground/60 hover:text-foreground hover:bg-muted border-wobbly-sm transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '⬆️' : '⬇️'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t-2 border-dashed border-foreground/20 space-y-2">
          {activity.description && (
            <p className="text-sm text-foreground/80 font-body">{activity.description}</p>
          )}
          {activity.estimatedCost && (
            <p className="text-sm text-foreground/70 font-body">💰 Estimated cost: ${activity.estimatedCost}</p>
          )}
          {activity.notes && (
            <p className="text-sm text-foreground/60 font-body italic">💭 {activity.notes}</p>
          )}
        </div>
      )}
    </HandDrawnCard>
  );
}
