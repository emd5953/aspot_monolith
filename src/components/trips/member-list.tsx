'use client';

import { Trash2 } from 'lucide-react';

interface Member {
  id: string;
  userId: string;
  role: 'organizer' | 'editor' | 'viewer';
  profile?: {
    displayName: string;
    avatarUrl?: string;
  };
}

interface MemberListProps {
  members: Member[];
  currentUserId: string;
  isOrganizer: boolean;
  onUpdateRole?: (userId: string, role: 'editor' | 'viewer') => Promise<void>;
  onRemove?: (userId: string) => Promise<void>;
}

const ROLE_TONES: Record<string, string> = {
  organizer: 'bg-[color:var(--ink)] text-white border-[color:var(--ink)]',
  editor: 'bg-sky-50 text-sky-800 border-sky-200',
  viewer: 'bg-[color:var(--surface-soft)] text-[color:var(--ink-muted)] border-[color:var(--border)]',
};

const SELECT_CLASS =
  'px-3 py-1.5 rounded-full bg-white border border-[color:var(--border)] text-[color:var(--ink)] text-xs font-medium ' +
  "appearance-none cursor-pointer bg-[url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230b1e3c' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>\")] " +
  'bg-[length:12px_12px] bg-[right_0.75rem_center] bg-no-repeat pr-8';

export function MemberList({
  members,
  currentUserId,
  isOrganizer,
  onUpdateRole,
  onRemove,
}: MemberListProps) {
  const handleRoleChange = async (userId: string, newRole: 'editor' | 'viewer') => {
    if (onUpdateRole) await onUpdateRole(userId, newRole);
  };

  const handleRemove = async (userId: string) => {
    if (onRemove && confirm('Remove this member from the trip?')) {
      await onRemove(userId);
    }
  };

  return (
    <div className="space-y-3">
      {members.map((member) => (
        <div
          key={member.id}
          className="flex items-center justify-between gap-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color:var(--border)] bg-white">
              {member.profile?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={member.profile.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="font-heading text-lg text-[color:var(--ink)]">
                  {member.profile?.displayName?.[0]?.toUpperCase() || '?'}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-heading text-lg text-[color:var(--ink)]">
                {member.profile?.displayName || 'Unknown'}
                {member.userId === currentUserId && (
                  <span className="ml-2 font-sans text-xs font-normal text-[color:var(--ink-soft)]">
                    (you)
                  </span>
                )}
              </p>
              <span
                className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${ROLE_TONES[member.role]}`}
              >
                {member.role}
              </span>
            </div>
          </div>

          {isOrganizer &&
            member.role !== 'organizer' &&
            member.userId !== currentUserId && (
              <div className="flex shrink-0 items-center gap-2">
                <select
                  value={member.role}
                  onChange={(e) =>
                    handleRoleChange(member.userId, e.target.value as 'editor' | 'viewer')
                  }
                  className={SELECT_CLASS}
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  onClick={() => handleRemove(member.userId)}
                  title="Remove member"
                  aria-label="Remove member"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--ink-soft)] transition-all hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            )}
        </div>
      ))}
    </div>
  );
}
