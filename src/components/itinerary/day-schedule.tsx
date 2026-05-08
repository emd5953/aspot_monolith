'use client';

import { useState } from 'react';
import { Pencil, Plus, List, Clock } from 'lucide-react';
import { ActivityCard } from './activity-card';
import { TimelineView } from './timeline-view';
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

interface DayScheduleProps {
  dayNumber: number;
  date: Date;
  activities: Activity[];
  notes?: string;
  onEditActivity?: (activity: Activity) => void;
  onDeleteActivity?: (activityId: string) => void;
  onAddActivity?: () => void;
  onReorder?: (activityIds: string[]) => void;
  onEditDay?: () => void;
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
  onEditDay,
}: DayScheduleProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });

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

    const currentOrder = activities.map((a) => a.id);
    const draggedIndex = currentOrder.indexOf(draggedId);
    const targetIndex = currentOrder.indexOf(targetId);

    currentOrder.splice(draggedIndex, 1);
    currentOrder.splice(targetIndex, 0, draggedId);

    onReorder(currentOrder);
    setDraggedId(null);
  };

  const handleDragEnd = () => setDraggedId(null);

  const sortedActivities = [...activities].sort((a, b) => a.sortOrder - b.sortOrder);
  const hasTimingInfo = sortedActivities.some((a) => a.startTime && a.endTime);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[color:var(--ink-muted)]">Day {dayNumber}</p>
          <h3 className="mt-1 font-heading text-2xl text-[color:var(--ink)]">{formatDate(date)}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasTimingInfo && (
            <div className="inline-flex rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-1">
              <ViewToggle
                selected={viewMode === 'list'}
                onClick={() => setViewMode('list')}
                icon={<List className="h-3.5 w-3.5" strokeWidth={2} />}
                label="List"
              />
              <ViewToggle
                selected={viewMode === 'timeline'}
                onClick={() => setViewMode('timeline')}
                icon={<Clock className="h-3.5 w-3.5" strokeWidth={2} />}
                label="Timeline"
              />
            </div>
          )}
          {onEditDay && (
            <HandDrawnButton onClick={onEditDay} variant="primary" size="sm" className="gap-2">
              <Pencil className="h-3.5 w-3.5" strokeWidth={2.5} />
              Edit day
            </HandDrawnButton>
          )}
          {onAddActivity && (
            <HandDrawnButton
              onClick={onAddActivity}
              variant="secondary"
              size="sm"
              className="gap-2"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              Add activity
            </HandDrawnButton>
          )}
        </div>
      </div>

      {notes && (
        <div className="mb-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
          <p className="mb-1 text-sm font-medium text-[color:var(--ink-muted)]">Note</p>
          <p className="text-sm italic text-[color:var(--ink)]">{notes}</p>
        </div>
      )}

      <div className="space-y-4">
        {sortedActivities.length === 0 ? (
          <HandDrawnCard className="p-10 text-center">
            <p className="text-sm text-[color:var(--ink-muted)]">
              No activities planned for this day
            </p>
          </HandDrawnCard>
        ) : viewMode === 'timeline' && hasTimingInfo ? (
          <HandDrawnCard className="p-6">
            <TimelineView activities={sortedActivities} />
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
    </div>
  );
}

function ViewToggle({
  selected,
  onClick,
  icon,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
        selected
          ? 'bg-[color:var(--ink)] text-white'
          : 'text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
