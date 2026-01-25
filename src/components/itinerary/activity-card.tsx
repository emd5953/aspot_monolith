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
  category: string;
  estimatedCost?: number;
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
    activity: '🎯',
    transport: '🚗',
    accommodation: '🏨',
  };

  const categoryColors: Record<string, string> = {
    attraction: 'bg-secondary-accent/20 text-secondary-accent border-secondary-accent',
    dining: 'bg-accent/20 text-accent border-accent',
    activity: 'bg-post-it border-foreground',
    transport: 'bg-muted border-foreground',
    accommodation: 'bg-card border-foreground',
  };

  const categoryColor = categoryColors[activity.category] || 'bg-muted border-foreground';
  const emoji = categoryEmojis[activity.category] || '📍';

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
              <span className="text-xs text-foreground/60 font-body">
                🕐 {activity.startTime} - {activity.endTime}
              </span>
            )}
          </div>
          <h4 className="font-heading text-lg text-foreground">{activity.title}</h4>
          {activity.locationName && (
            <p className="text-sm text-foreground/70 mt-1 font-body">📍 {activity.locationName}</p>
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
