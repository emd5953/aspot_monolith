'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Edit2, Trash2, MapPin, Clock, Ticket } from 'lucide-react';
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

const CATEGORY_ICONS: Record<string, string> = {
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

const CATEGORY_CHIP_TONES: Record<string, string> = {
  attraction: 'bg-sky-50 text-sky-800 border-sky-200',
  dining: 'bg-rose-50 text-rose-800 border-rose-200',
  breakfast: 'bg-amber-50 text-amber-800 border-amber-200',
  lunch: 'bg-orange-50 text-orange-800 border-orange-200',
  dinner: 'bg-rose-50 text-rose-800 border-rose-200',
  activity: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  transport: 'bg-slate-50 text-slate-700 border-slate-200',
  accommodation: 'bg-[color:var(--surface-soft)] text-[color:var(--ink)] border-[color:var(--border)]',
  museum: 'bg-violet-50 text-violet-800 border-violet-200',
  shopping: 'bg-pink-50 text-pink-800 border-pink-200',
  entertainment: 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200',
  nightlife: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  nature: 'bg-teal-50 text-teal-800 border-teal-200',
  beach: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  sports: 'bg-blue-50 text-blue-800 border-blue-200',
};

export function ActivityCard({ activity, onEdit, onDelete, isDragging }: ActivityCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const tone =
    CATEGORY_CHIP_TONES[activity.category] ??
    'bg-[color:var(--surface-soft)] text-[color:var(--ink)] border-[color:var(--border)]';
  const emoji = CATEGORY_ICONS[activity.category] || '📍';

  const getDurationDisplay = () => {
    if (!activity.startTime || !activity.endTime) return null;
    const [sh, sm] = activity.startTime.split(':').map(Number);
    const [eh, em] = activity.endTime.split(':').map(Number);
    const mins = eh * 60 + em - (sh * 60 + sm);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const durationDisplay = getDurationDisplay();

  return (
    <HandDrawnCard
      className={`p-5 transition-all ${
        isDragging
          ? 'rotate-1 scale-[1.02] border-[color:var(--accent)]/40 bg-white'
          : 'hover:border-[color:var(--border-strong)] hover:bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${tone}`}
            >
              <span aria-hidden>{emoji}</span>
              {activity.category}
            </span>
            {activity.startTime && activity.endTime && (
              <span className="inline-flex items-center gap-1.5 text-xs text-[color:var(--ink-muted)]">
                <Clock className="h-3 w-3" strokeWidth={2} />
                {activity.startTime} – {activity.endTime}
                {durationDisplay && (
                  <span className="text-[color:var(--ink-soft)]">({durationDisplay})</span>
                )}
              </span>
            )}
          </div>

          <h4 className="font-heading text-xl leading-tight text-[color:var(--ink)]">
            {activity.title}
          </h4>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {activity.locationName && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.locationName)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-[color:var(--ink-muted)] transition-colors hover:text-[color:var(--ink)]"
              >
                <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
                {activity.locationName}
              </a>
            )}
            {activity.bookingUrl && (
              <a
                href={activity.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--accent)] underline decoration-[color:var(--accent)]/40 underline-offset-4 hover:decoration-[color:var(--accent)]"
              >
                <Ticket className="h-3.5 w-3.5" strokeWidth={2} />
                Booking
              </a>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {onEdit && (
            <IconButton label="Edit" onClick={() => onEdit(activity)}>
              <Edit2 className="h-4 w-4" strokeWidth={2} />
            </IconButton>
          )}
          {onDelete && (
            <IconButton label="Delete" onClick={() => onDelete(activity.id)} danger>
              <Trash2 className="h-4 w-4" strokeWidth={2} />
            </IconButton>
          )}
          <IconButton
            label={isExpanded ? 'Collapse' : 'Expand'}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" strokeWidth={2} />
            ) : (
              <ChevronDown className="h-4 w-4" strokeWidth={2} />
            )}
          </IconButton>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-2 border-t border-[color:var(--border)] pt-4">
          {activity.description && (
            <p className="text-sm leading-relaxed text-[color:var(--ink)]">{activity.description}</p>
          )}
          {activity.estimatedCost && (
            <p className="text-sm text-[color:var(--ink-muted)]">
              Estimated cost · ${activity.estimatedCost}
            </p>
          )}
          {activity.notes && (
            <p className="text-sm italic text-[color:var(--ink-muted)]">{activity.notes}</p>
          )}
        </div>
      )}
    </HandDrawnCard>
  );
}

function IconButton({
  children,
  onClick,
  label,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border)] transition-all ${
        danger
          ? 'text-[color:var(--ink-soft)] hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600'
          : 'text-[color:var(--ink-muted)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--ink)]'
      }`}
    >
      {children}
    </button>
  );
}
