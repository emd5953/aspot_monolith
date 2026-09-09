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
  Share2,
} from 'lucide-react';
import { PlanList } from './plan-list';
import { ItineraryMap } from './itinerary-map';
import { Card } from '@/components/ui/card';
import { OverflowMenu } from '@/components/ui/overflow-menu';
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
  locationCoords?: { lat: number; lng: number };
}

interface Itinerary {
  id: string;
  title: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  status: string;
  /** The Move-list, in rendered order. */
  plans: Activity[];
  importantNotes?: string[];
  budgetRange?: string;
}

interface ItineraryViewProps {
  itinerary: Itinerary;
  onEditActivity?: (activity: Activity) => void;
  onDeleteActivity?: (activityId: string) => void;
  onAddActivity?: () => void;
  onReorderActivities?: (planIds: string[]) => void;
  onRegenerate?: () => void;
  onDelete?: () => void;
  onStatusChange?: (status: string) => void;
  onTitleChange?: (title: string) => void;
}

const STATUS_TONES: Record<string, string> = {
  draft:
    'bg-[color:var(--surface-soft)] text-[color:var(--ink-muted)] border-[color:var(--border)]',
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
  onTitleChange,
}: ItineraryViewProps) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(itinerary.title);
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');

  const handleShare = async () => {
    try {
      const res = await fetch(`/api/itinerary/${itinerary.id}/share`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create share link');
      const { path } = await res.json();
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setShareState('copied');
      setTimeout(() => setShareState('idle'), 2000);
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const formatDateRange = (start: Date, end: Date) => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', options)} – ${end.toLocaleDateString('en-US', options)}`;
  };

  // Estimated cost rollup + budget fit (only meaningful when plans carry cost
  // estimates — many don't, so guard on hasData). One night, so the rollup
  // takes the single-day shape it still expects.
  const cost = rollUpCost([{ activities: itinerary.plans }]);
  const budgetFit = cost.hasData
    ? classifyBudget(cost.total, itinerary.budgetRange, 1)
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
    <div className="space-y-3">
      {/* Header */}
      <Card className="animate-fade-up p-5 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {isEditingTitle ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={handleTitleKeyDown}
                className="w-full max-w-2xl border-b-2 border-[color:var(--border)] bg-transparent py-1 font-heading text-3xl leading-[1] text-[color:var(--ink)] outline-none focus:border-[color:var(--accent)] sm:text-4xl md:text-5xl"
                autoFocus
              />
            ) : (
              <div className="group flex items-center gap-2">
                <h1 className="min-w-0 break-words font-heading text-3xl leading-[1] text-[color:var(--ink)] sm:text-4xl md:text-5xl">
                  {itinerary.title}
                </h1>
                <button
                  onClick={() => setIsEditingTitle(true)}
                  // Always visible on touch — there is no hover to reveal it.
                  // Reverts to the hover-only treatment from md up.
                  className="tap-target flex shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--ink-soft)] opacity-100 transition-opacity hover:border-[color:var(--border-strong)] hover:text-[color:var(--ink)] md:h-8 md:w-8 md:min-h-0 md:min-w-0 md:opacity-0 md:group-hover:opacity-100"
                  title="Edit title"
                  aria-label="Edit itinerary title"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-[color:var(--ink-muted)]">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                <span className="truncate">{itinerary.destination}</span>
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

          {/* Status stays visible — it's state, not an action. Everything the
              user can *do* collapses into one menu; the old row of five equal
              pills made nothing look primary and wrapped raggedly on phones. */}
          <div className="flex shrink-0 items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                aria-expanded={showStatusMenu}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium capitalize ${STATUS_TONES[itinerary.status] ?? STATUS_TONES.draft}`}
              >
                {itinerary.status}
                <ChevronDown className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              </button>
              {showStatusMenu && (
                <div className="absolute top-full right-0 z-30 mt-2 min-w-[160px] overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-card)]">
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
                          aria-hidden
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <OverflowMenu
              actions={[
                {
                  label: shareState === 'copied' ? 'Link copied' : 'Share',
                  onSelect: handleShare,
                  icon: <Share2 className="h-4 w-4" strokeWidth={2} aria-hidden />,
                },
                {
                  label: 'Add to calendar',
                  onSelect: () => {},
                  href: `/api/itinerary/${itinerary.id}/calendar`,
                  download: true,
                  icon: <Calendar className="h-4 w-4" strokeWidth={2} aria-hidden />,
                },
                ...(onRegenerate
                  ? [
                      {
                        label: 'Regenerate',
                        onSelect: onRegenerate,
                        icon: <RefreshCw className="h-4 w-4" strokeWidth={2} aria-hidden />,
                      },
                    ]
                  : []),
                ...(onDelete
                  ? [
                      {
                        label: 'Delete',
                        onSelect: onDelete,
                        destructive: true,
                        icon: <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />,
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Map */}
      <Card className="animate-fade-up p-4 md:p-6" style={{ animationDelay: '0.05s' }}>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium text-[color:var(--ink-muted)]">Route</p>
          {cost.hasData && (
            <p className="text-sm font-medium text-[color:var(--ink)]">
              Est. {formatUsd(cost.total)}
            </p>
          )}
        </div>
        <ItineraryMap destination={itinerary.destination} activities={itinerary.plans} />
      </Card>

      {/* Good to know — notes from the planner */}
      {(itinerary.importantNotes?.length ?? 0) > 0 && (
        <Card
          className="animate-fade-up p-5 md:p-6"
          style={{ animationDelay: '0.08s' }}
        >
          <h3 className="text-sm font-medium text-[color:var(--ink-muted)]">Good to know</h3>
          <ul className="mt-3 space-y-1.5 text-sm text-[color:var(--ink-muted)]">
            {itinerary.importantNotes!.map((note, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden>📌</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* The Move-list */}
      <Card className="animate-fade-up p-4 md:p-6" style={{ animationDelay: '0.1s' }}>
        <PlanList
          plans={itinerary.plans}
          onEditPlan={onEditActivity}
          onDeletePlan={onDeleteActivity}
          onAddPlan={onAddActivity}
          onReorder={onReorderActivities}
        />
      </Card>
    </div>
  );
}
