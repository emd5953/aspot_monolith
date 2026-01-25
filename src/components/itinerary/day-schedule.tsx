'use client';

import { useState } from 'react';
import { ActivityCard } from './activity-card';

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
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Day {dayNumber}
          </h3>
          <p className="text-sm text-gray-500">{formatDate(date)}</p>
        </div>
        {onAddActivity && (
          <button
            onClick={onAddActivity}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Activity
          </button>
        )}
      </div>

      {notes && (
        <p className="text-sm text-gray-600 mb-4 italic">{notes}</p>
      )}

      <div className="space-y-3">
        {sortedActivities.length === 0 ? (
          <p className="text-center text-gray-400 py-8">
            No activities planned for this day
          </p>
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
    </div>
  );
}
