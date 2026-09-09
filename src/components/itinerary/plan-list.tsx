'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ActivityCard } from './activity-card';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ItemSource } from '@/lib/ai/provenance';

interface Plan {
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
  source?: ItemSource;
}

interface PlanListProps {
  plans: Plan[];
  onEditPlan?: (plan: Plan) => void;
  onDeletePlan?: (planId: string) => void;
  onAddPlan?: () => void;
  onReorder?: (planIds: string[]) => void;
}

/**
 * The Move-list: one flat run of stops for the night.
 *
 * Replaces `DaySchedule`. There are no day tabs, no morning/afternoon/evening
 * headers and no timeline toggle, because nothing here is scheduled — each
 * stop shows the time its source published, or no time at all.
 *
 * `sortOrder` is the rendered order. It is seeded from real start times at
 * generation, and a manual reorder overwrites it permanently: once the user
 * has arranged the night, the list stays arranged.
 */
export function PlanList({
  plans,
  onEditPlan,
  onDeletePlan,
  onAddPlan,
  onReorder,
}: PlanListProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const sorted = [...plans].sort((a, b) => a.sortOrder - b.sortOrder);

  const handleDragStart = (e: React.DragEvent, planId: string) => {
    setDraggedId(planId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId || !onReorder) return;

    const order = sorted.map((p) => p.id);
    const from = order.indexOf(draggedId);
    const to = order.indexOf(targetId);
    order.splice(from, 1);
    order.splice(to, 0, draggedId);

    onReorder(order);
    setDraggedId(null);
  };

  const handleDragEnd = () => setDraggedId(null);

  /**
   * Touch-path reorder. Moves one plan by `offset` and hands the new id order
   * to the same `onReorder` the drag path uses, so both routes hit the reorder
   * endpoint identically.
   */
  const move = (index: number, offset: number) => {
    if (!onReorder) return;
    const ids = sorted.map((p) => p.id);
    const target = index + offset;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    onReorder(ids);
  };

  return (
    <div>
      {onAddPlan && (
        <div className="mb-4 flex justify-end">
          <Button onClick={onAddPlan} variant="quiet" size="sm" className="gap-2">
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Add a spot
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {sorted.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-sm text-[color:var(--ink-muted)]">Nothing here yet</p>
          </Card>
        ) : (
          sorted.map((plan, index) => (
            <div
              key={plan.id}
              draggable={!!onReorder}
              onDragStart={(e) => handleDragStart(e, plan.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, plan.id)}
              onDragEnd={handleDragEnd}
              // `cursor-move` only from md up — below that there is no drag to
              // advertise, the arrow buttons inside the card do the work.
              className={onReorder ? 'md:cursor-move' : ''}
            >
              <ActivityCard
                activity={plan}
                onEdit={onEditPlan}
                onDelete={onDeletePlan}
                isDragging={draggedId === plan.id}
                canReorder={!!onReorder}
                onMoveUp={index > 0 ? () => move(index, -1) : undefined}
                onMoveDown={index < sorted.length - 1 ? () => move(index, 1) : undefined}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
