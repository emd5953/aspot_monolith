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
    organizer: 'bg-purple-100 text-purple-800',
    editor: 'bg-blue-100 text-blue-800',
    viewer: 'bg-gray-100 text-gray-800',
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
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-700">
        Members ({members.length})
      </h4>
      
      <div className="space-y-2">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between bg-white border rounded-lg p-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                {member.profile?.avatarUrl ? (
                  <img
                    src={member.profile.avatarUrl}
                    alt=""
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <span className="text-gray-500 text-sm font-medium">
                    {member.profile?.displayName?.[0]?.toUpperCase() || '?'}
                  </span>
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {member.profile?.displayName || 'Unknown'}
                  {member.userId === currentUserId && (
                    <span className="text-gray-500 text-sm ml-1">(you)</span>
                  )}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${roleColors[member.role]}`}>
                  {member.role}
                </span>
              </div>
            </div>

            {isOrganizer && member.role !== 'organizer' && member.userId !== currentUserId && (
              <div className="flex items-center gap-2">
                <select
                  value={member.role}
                  onChange={(e) => handleRoleChange(member.userId, e.target.value as 'editor' | 'viewer')}
                  className="text-sm border rounded px-2 py-1"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  onClick={() => handleRemove(member.userId)}
                  className="p-1 text-red-500 hover:text-red-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
