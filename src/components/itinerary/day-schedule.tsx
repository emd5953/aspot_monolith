'use client';

import { useState } from 'react';
import { ActivityCard } from './activity-card';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';

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

interface DayScheduleProps {
  dayNumber: number;
  date: Date;
  activities: Activity[];
  notes?: string;
  onEditActivity?: (activity: Activity) => void;
  onDeleteActivity?: (activityId: string) => void;
  onAddActivity?: () => void;
  onReorder?: (activityIds: string[]) => void;
}

export function DaySchedule({
  dayNumber,
  date,
  activities,
  notes,
  onEditActivity,
  onDeleteActivity,
  onAddActivity,
  onReorder,
}: DayScheduleProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const formatDate = (d: Date) => {
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDragStart = (e: React.DragEvent, activityId: string) => {
    setDraggedId(activityId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId || !onReorder) return;

    const currentOrder = activities.map(a => a.id);
    const draggedIndex = currentOrder.indexOf(draggedId);
    const targetIndex = currentOrder.indexOf(targetId);

    currentOrder.splice(draggedIndex, 1);
    currentOrder.splice(targetIndex, 0, draggedId);

    onReorder(currentOrder);
    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  const sortedActivities = [...activities].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <HandDrawnCard decoration="tack" className="p-6 bg-muted/30">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-heading text-foreground -rotate-1">
            📅 Day {dayNumber}
          </h3>
          <p className="text-base text-foreground/70 font-body">{formatDate(date)}</p>
        </div>
        {onAddActivity && (
          <HandDrawnButton
            onClick={onAddActivity}
            variant="secondary"
            size="sm"
          >
            ➕ Add Activity
          </HandDrawnButton>
        )}
      </div>

      {notes && (
        <HandDrawnCard variant="post-it" className="p-3 mb-4">
          <p className="text-sm text-foreground/80 font-body italic">💭 {notes}</p>
        </HandDrawnCard>
      )}

      <div className="space-y-4">
        {sortedActivities.length === 0 ? (
          <HandDrawnCard className="p-8 text-center bg-card">
            <p className="text-foreground/60 font-body">
              📭 No activities planned for this day yet
            </p>
          </HandDrawnCard>
        ) : (
          sortedActivities.map((activity) => (
            <div
              key={activity.id}
              draggable={!!onReorder}
              onDragStart={(e) => handleDragStart(e, activity.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, activity.id)}
              onDragEnd={handleDragEnd}
              className={onReorder ? 'cursor-move' : ''}
            >
              <ActivityCard
                activity={activity}
                onEdit={onEditActivity}
                onDelete={onDeleteActivity}
                isDragging={draggedId === activity.id}
              />
            </div>
          ))
        )}
      </div>
    </HandDrawnCard>
  );
}
