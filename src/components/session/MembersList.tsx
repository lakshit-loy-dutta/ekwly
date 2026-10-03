import { Trash2 } from 'lucide-react';
import type { DBMember } from '../../lib/useSession';

interface Props {
  members: DBMember[];
  newMemberName: string;
  setNewMemberName: (val: string) => void;
  handleAddMember: () => void;
  handleRemoveMember: (id: string) => void;
  currentUserId: string | null;
  handleClaimProfile: (id: string) => void;
}

export default function MembersList(props: Props) {
  return (
    <div className="w-full flex flex-col">
      <div className="bg-surface border-y border-border p-4 flex gap-3">
        <input
          type="text"
          value={props.newMemberName}
          onChange={(e) => props.setNewMemberName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && props.handleAddMember()}
          placeholder="New Member Name"
          className="flex-1 h-11 px-3 text-sm font-medium bg-page border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
        <button
          type="button"
          className="h-11 px-5 bg-primary active:bg-primary-hover text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
          onClick={props.handleAddMember}
        >
          Add
        </button>
      </div>

      <div className="px-4 py-3 mt-4">
        <h3 className="text-xs font-bold text-muted uppercase tracking-widest">
          Session Members ({props.members.length})
        </h3>
      </div>

      <div className="bg-surface border-y border-border divide-y divide-border">
        {props.members.length === 0 && (
          <div className="p-8 text-center text-sm text-muted">No members joined yet.</div>
        )}
        {props.members.map((m) => {
          const isMe = m.user_id === props.currentUserId;
          const canClaim =
            !m.user_id &&
            props.currentUserId &&
            !props.members.some((mem) => mem.user_id === props.currentUserId);

          return (
            <div key={m.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-main text-[1.05rem]">{m.name}</span>
                {isMe && (
                  <span className="text-[0.65rem] font-bold text-success bg-success/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                    You
                  </span>
                )}
                {canClaim && (
                  <button
                    onClick={() => props.handleClaimProfile(m.id)}
                    className="text-[0.65rem] font-bold text-primary bg-primary/10 px-2 py-1 rounded uppercase tracking-wider active:bg-primary/20"
                  >
                    Claim Profile
                  </button>
                )}
              </div>
              <button
                onClick={() => props.handleRemoveMember(m.id)}
                className="text-muted active:text-danger p-1 transition-colors"
              >
                <Trash2 size={20} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
