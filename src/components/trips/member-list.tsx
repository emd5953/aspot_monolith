'use client';

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

export function MemberList({ 
  members, 
  currentUserId, 
  isOrganizer,
  onUpdateRole,
  onRemove 
}: MemberListProps) {
  const roleColors = {
    organizer: 'bg-accent/20 text-accent border-accent',
    editor: 'bg-secondary-accent/20 text-secondary-accent border-secondary-accent',
    viewer: 'bg-muted text-foreground/70 border-foreground',
  };

  const handleRoleChange = async (userId: string, newRole: 'editor' | 'viewer') => {
    if (onUpdateRole) {
      await onUpdateRole(userId, newRole);
    }
  };

  const handleRemove = async (userId: string) => {
    if (onRemove && confirm('Remove this member from the trip?')) {
      await onRemove(userId);
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="text-xl font-heading text-foreground">
        👥 Members ({members.length})
      </h4>
      
      <div className="space-y-3">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between bg-card border-2 border-wobbly-sm border-foreground p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-accent/20 border-2 border-foreground rounded-full flex items-center justify-center">
                {member.profile?.avatarUrl ? (
                  <img
                    src={member.profile.avatarUrl}
                    alt=""
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <span className="text-foreground text-lg font-heading">
                    {member.profile?.displayName?.[0]?.toUpperCase() || '?'}
                  </span>
                )}
              </div>
              <div>
                <p className="font-heading text-foreground text-lg">
                  {member.profile?.displayName || 'Unknown'}
                  {member.userId === currentUserId && (
                    <span className="text-foreground/60 text-sm font-body ml-2">(you)</span>
                  )}
                </p>
                <span className={`text-xs font-body px-2 py-1 border-2 border-wobbly-sm ${roleColors[member.role]}`}>
                  {member.role}
                </span>
              </div>
            </div>

            {isOrganizer && member.role !== 'organizer' && member.userId !== currentUserId && (
              <div className="flex items-center gap-2">
                <select
                  value={member.role}
                  onChange={(e) => handleRoleChange(member.userId, e.target.value as 'editor' | 'viewer')}
                  className="text-sm font-body border-2 border-foreground px-2 py-1 bg-card"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  onClick={() => handleRemove(member.userId)}
                  className="p-2 text-red-500 hover:text-red-700 border-2 border-red-500 hover:bg-red-50 transition-colors"
                  title="Remove member"
                >
                  🗑️
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
