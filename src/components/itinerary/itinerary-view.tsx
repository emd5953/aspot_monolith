'use client';

import { useState } from 'react';
import {
  Pencil,
  RefreshCw,
  Trash2,
  ChevronDown,
  MapPin,
  Calendar,
  Check,
} from 'lucide-react';
import { DaySchedule } from './day-schedule';
import { ItineraryMap } from './itinerary-map';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';
import type { ItemSource } from '@/lib/ai/provenance';
import {
  rollUpCost,
  classifyBudget,
  formatUsd,
  BUDGET_STATUS_LABEL,
  type BudgetStatus,
} from '@/lib/itinerary/cost';

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
  source?: ItemSource;
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
  packingTips?: string[];
  importantNotes?: string[];
  budgetRange?: string;
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
  onTitleChange?: (title: string) => void;
}

const STATUS_TONES: Record<string, string> = {
  draft: 'bg-[color:var(--surface-soft)] text-[color:var(--ink-muted)] border-[color:var(--border)]',
  active: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  completed: 'bg-sky-50 text-sky-800 border-sky-200',
  archived: 'bg-slate-100 text-slate-600 border-slate-200',
};

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
  onTitleChange,
}: ItineraryViewProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(itinerary.title);

  const formatDateRange = (start: Date, end: Date) => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', options)} – ${end.toLocaleDateString('en-US', options)}`;
  };

  // Estimated cost rollup + budget fit (only meaningful when activities carry
  // cost estimates — many don't, so guard on hasData).
  const cost = rollUpCost(itinerary.days);
  const budgetFit = cost.hasData
    ? classifyBudget(cost.total, itinerary.budgetRange, itinerary.days.length)
    : null;
  const BUDGET_TONE: Record<BudgetStatus, string> = {
    under: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    within: 'bg-sky-50 text-sky-800 border-sky-200',
    over: 'bg-amber-50 text-amber-800 border-amber-200',
  };

  const handleTitleSave = () => {
    if (editedTitle.trim() && editedTitle !== itinerary.title) {
      onTitleChange?.(editedTitle.trim());
    } else {
      setEditedTitle(itinerary.title);
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleTitleSave();
    if (e.key === 'Escape') {
      setEditedTitle(itinerary.title);
      setIsEditingTitle(false);
    }
  };

  return (
    <div className="space-y-1.5">
      {/* Header */}
      <HandDrawnCard className="animate-fade-up p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {isEditingTitle ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={handleTitleKeyDown}
                className="w-full max-w-2xl border-b-2 border-[color:var(--border)] bg-transparent py-1 font-heading text-4xl leading-[1] text-[color:var(--ink)] outline-none focus:border-[color:var(--accent)] md:text-5xl"
                autoFocus
              />
            ) : (
              <div className="group flex items-center gap-2">
                <h1 className="font-heading text-4xl leading-[1] text-[color:var(--ink)] md:text-5xl">
                  {itinerary.title}
                </h1>
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--ink-soft)] opacity-0 transition-opacity hover:border-[color:var(--border-strong)] hover:text-[color:var(--ink)] group-hover:opacity-100"
                  title="Edit title"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-[color:var(--ink-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
                {itinerary.destination}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" strokeWidth={2} />
                {formatDateRange(itinerary.startDate, itinerary.endDate)}
              </span>
              {cost.hasData && (
                <span className="inline-flex items-center gap-2">
                  <span className="font-medium text-[color:var(--ink)]">
                    Est. {formatUsd(cost.total)}
                  </span>
                  {budgetFit && (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${BUDGET_TONE[budgetFit.status]}`}
                    >
                      {BUDGET_STATUS_LABEL[budgetFit.status]}
                    </span>
                  )}
                </span>
              )}
              <span className="text-xs text-[color:var(--ink-soft)]">Auto-saved</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium capitalize ${STATUS_TONES[itinerary.status] ?? STATUS_TONES.draft}`}
              >
                {itinerary.status}
                <ChevronDown className="h-3 w-3" strokeWidth={2.5} />
              </button>
              {showStatusMenu && (
                <div className="absolute top-full right-0 z-20 mt-2 min-w-[160px] overflow-hidden rounded-2xl border border-[color:var(--border)] bg-white shadow-[0_24px_64px_-20px_rgba(20,50,100,0.3)]">
                  {(['draft', 'active', 'completed', 'archived'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => {
                        onStatusChange?.(status);
                        setShowStatusMenu(false);
                      }}
                      className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm capitalize text-[color:var(--ink)] transition-colors hover:bg-[color:var(--surface-soft)] ${
                        itinerary.status === status ? 'bg-[color:var(--surface-soft)]' : ''
                      }`}
                    >
                      {status}
                      {itinerary.status === status && (
                        <Check
                          className="ml-auto h-3.5 w-3.5 text-[color:var(--accent)]"
                          strokeWidth={2.5}
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {onRegenerate && (
              <HandDrawnButton onClick={onRegenerate} variant="primary" size="sm" className="gap-2">
                <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.5} />
                Regenerate
              </HandDrawnButton>
            )}
            <a
              href={`/api/itinerary/${itinerary.id}/calendar`}
              download
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white bg-white/80 px-4 py-1.5 text-sm font-medium text-[color:var(--ink)] shadow-[0_8px_20px_-12px_rgba(20,50,100,0.25)] backdrop-blur-md transition-all hover:-translate-y-[1px] hover:bg-white active:translate-y-0"
            >
              <Calendar className="h-3.5 w-3.5" strokeWidth={2} />
              Add to calendar
            </a>
            {onDelete && (
              <HandDrawnButton onClick={onDelete} variant="secondary" size="sm" className="gap-2">
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                Delete
              </HandDrawnButton>
            )}
          </div>
        </div>
      </HandDrawnCard>

      {/* Map */}
      <HandDrawnCard className="animate-fade-up p-6" style={{ animationDelay: '0.05s' }}>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium text-[color:var(--ink-muted)]">
            Day {itinerary.days[activeTab]?.dayNumber} route
          </p>
          {cost.hasData && cost.perDay[activeTab] > 0 && (
            <p className="text-sm font-medium text-[color:var(--ink)]">
              Est. {formatUsd(cost.perDay[activeTab])}
            </p>
          )}
        </div>
        <ItineraryMap
          destination={itinerary.destination}
          activities={itinerary.days[activeTab]?.activities || []}
        />
      </HandDrawnCard>

      {/* Before you go — packing tips + important notes from the planner */}
      {((itinerary.packingTips?.length ?? 0) > 0 ||
        (itinerary.importantNotes?.length ?? 0) > 0) && (
        <HandDrawnCard
          className="animate-fade-up grid gap-6 p-6 md:grid-cols-2"
          style={{ animationDelay: '0.08s' }}
        >
          {(itinerary.packingTips?.length ?? 0) > 0 && (
            <div>
              <h3 className="font-heading text-lg text-[color:var(--ink)]">Packing tips</h3>
              <ul className="mt-3 space-y-1.5 text-sm text-[color:var(--ink-muted)]">
                {itinerary.packingTips!.map((tip, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden>🧳</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(itinerary.importantNotes?.length ?? 0) > 0 && (
            <div>
              <h3 className="font-heading text-lg text-[color:var(--ink)]">Good to know</h3>
              <ul className="mt-3 space-y-1.5 text-sm text-[color:var(--ink-muted)]">
                {itinerary.importantNotes!.map((note, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden>📌</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </HandDrawnCard>
      )}

      {/* Day Tabs */}
      <HandDrawnCard
        className="animate-fade-up overflow-hidden p-0"
        style={{ animationDelay: '0.1s' }}
      >
        <div className="border-b border-[color:var(--border)] px-2 pt-2">
          <div className="flex gap-1 overflow-x-auto">
            {itinerary.days.map((day, index) => (
              <button
                key={day.id}
                onClick={() => setActiveTab(index)}
                className={`whitespace-nowrap rounded-t-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  activeTab === index
                    ? 'bg-[color:var(--surface-soft)] text-[color:var(--ink)]'
                    : 'text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-soft)]/60 hover:text-[color:var(--ink)]'
                }`}
              >
                Day {day.dayNumber}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {itinerary.days[activeTab] && (
            <DaySchedule
              dayNumber={itinerary.days[activeTab].dayNumber}
              date={itinerary.days[activeTab].date}
              activities={itinerary.days[activeTab].activities}
              notes={itinerary.days[activeTab].notes}
              onEditActivity={onEditActivity}
              onDeleteActivity={onDeleteActivity}
              onAddActivity={
                onAddActivity ? () => onAddActivity(itinerary.days[activeTab].id) : undefined
              }
              onReorder={
                onReorderActivities
                  ? (ids) => onReorderActivities(itinerary.days[activeTab].id, ids)
                  : undefined
              }
              onEditDay={
                onEditDay
                  ? () =>
                      onEditDay(
                        itinerary.days[activeTab].id,
                        itinerary.days[activeTab].dayNumber,
                        itinerary.days[activeTab].activities
                      )
                  : undefined
              }
            />
          )}
        </div>
      </HandDrawnCard>
    </div>
  );
}
