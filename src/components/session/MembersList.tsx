import { useState, useEffect } from 'react';
import { Trash2, User, Search, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { showToast } from '../../lib/utils';
import { useSessionContext } from '../../lib/SessionContext';

export default function MembersList() {
  const { members, currentUserId, actions } = useSessionContext();

  // Local State Encapsulation
  const [newMemberName, setNewMemberName] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Debounced live search against the profiles table
  useEffect(() => {
    if (newMemberName.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const fetchProfiles = async () => {
      setIsSearching(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .ilike('name', `%${newMemberName.trim()}%`)
        .limit(5);
      setSearchResults(data || []);
      setShowDropdown(true);
      setIsSearching(false);
    };

    const delayDebounceFn = setTimeout(() => fetchProfiles(), 300);
    return () => clearTimeout(delayDebounceFn);
  }, [newMemberName]);

  const handleAddMember = async (selectedName?: string, selectedUserId?: string) => {
    const finalName = selectedName || newMemberName;
    if (!finalName.trim()) return showToast('Name cannot be empty.', 'error');
    await actions.addMemberToDB(finalName, selectedUserId);
    setNewMemberName('');
    setShowDropdown(false);
  };

  return (
    <div className="w-full flex flex-col">
      <div className="bg-surface border-y border-border p-4 flex flex-col gap-2 relative">
        <div className="flex gap-3 relative z-20">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted">
              {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            </div>
            <input
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
              placeholder="Search or add name..."
              className="w-full h-11 pl-10! pr-3 text-sm font-medium bg-page border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <button
            type="button"
            className="h-11 px-5 bg-primary active:bg-primary-hover text-white rounded-lg font-medium text-sm transition-colors shadow-sm shrink-0"
            onClick={() => handleAddMember()}
          >
            Add Guest
          </button>
        </div>

        {/* Smart Search Dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute top-16 left-4 right-4 bg-surface border border-border rounded-xl shadow-lg z-30 flex flex-col overflow-hidden max-h-60 overflow-y-auto">
            <div className="px-3 py-2 bg-page/50 border-b border-border text-[0.65rem] font-bold uppercase tracking-widest text-muted">
              Found Accounts
            </div>
            {searchResults.map((profile) => {
              if (members.some((m) => m.user_id === profile.id)) return null;
              return (
                <button
                  key={profile.id}
                  onClick={() => handleAddMember(profile.name, profile.id)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-subtle active:bg-border transition-colors text-left border-b border-border/50 last:border-0"
                >
                  <div className="w-8 h-8 rounded-full bg-primary-light text-primary flex items-center justify-center font-bold overflow-hidden shrink-0 border border-border">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User size={14} />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-semibold text-main text-sm truncate">{profile.name}</span>
                    <span className="text-xs text-muted truncate text-[0.7rem]">Ekwly User</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-4 py-3 mt-4">
        <h3 className="text-xs font-bold text-muted uppercase tracking-widest">
          Session Members ({members.length})
        </h3>
      </div>

      <div className="bg-surface border-y border-border divide-y divide-border">
        {members.length === 0 && (
          <div className="p-8 text-center text-sm text-muted">No members joined yet.</div>
        )}
        {members.map((m) => {
          const isMe = m.user_id === currentUserId;
          const canClaim =
            !m.user_id && currentUserId && !members.some((mem) => mem.user_id === currentUserId);
          const isRegistered = !!m.user_id;

          return (
            <div key={m.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-main text-[1.05rem]">{m.name}</span>
                {isMe && (
                  <span className="text-[0.65rem] font-bold text-success bg-success-light px-1.5 py-0.5 rounded uppercase tracking-wider">
                    You
                  </span>
                )}
                {!isMe && isRegistered && (
                  <span className="text-[0.65rem] font-bold text-primary bg-primary-light px-1.5 py-0.5 rounded uppercase tracking-wider">
                    Linked
                  </span>
                )}
                {canClaim && (
                  <button
                    onClick={() => actions.claimMemberIdentity(m.id)}
                    className="text-[0.65rem] font-bold text-primary bg-primary-light border border-primary/20 px-2 py-1 rounded uppercase tracking-wider active:bg-primary/20 transition-colors"
                  >
                    Claim Slot
                  </button>
                )}
              </div>
              <button
                onClick={() => actions.removeMemberFromDB(m.id)}
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
