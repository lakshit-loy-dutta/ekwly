import { useState, useEffect } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/utils';
import { User, Trash2, Users, Loader2, UserPlus } from 'lucide-react';

interface FriendProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  upi_id: string | null;
}

interface Props {
  user: SupabaseUser | null;
  onBack: () => void;
}

export default function Friends({ user, onBack }: Props) {
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFriends = async () => {
      if (!user || user.is_anonymous) {
        setIsLoading(false);
        return;
      }

      // Fetch connections where the user is either user_id OR friend_id
      const { data: connections } = await supabase
        .from('connections')
        .select('user_id, friend_id')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      if (!connections || connections.length === 0) {
        setFriends([]);
        setIsLoading(false);
        return;
      }

      // Extract just the IDs of the *other* person
      const friendIds = connections.map((c) => (c.user_id === user.id ? c.friend_id : c.user_id));

      // Fetch their public profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, upi_id')
        .in('id', friendIds);

      if (profiles) setFriends(profiles);
      setIsLoading(false);
    };

    fetchFriends();
  }, [user]);

  const handleRemoveFriend = async (friendId: string) => {
    if (!window.confirm('Remove this friend?')) return;

    // Delete the mutual connection regardless of who added who
    await supabase
      .from('connections')
      .delete()
      .or(
        `and(user_id.eq.${user?.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user?.id})`
      );

    setFriends((prev) => prev.filter((f) => f.id !== friendId));
    showToast('Friend removed.', 'success');
  };

  if (isLoading)
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Loader2 className="animate-spin text-primary opacity-50" size={32} />
      </div>
    );

  return (
    <div className="w-full flex flex-col flex-1 px-4 py-6 md:px-8 bg-page pb-24">
      <div className="flex flex-col items-center mb-8 mt-2">
        <div className="w-16 h-16 rounded-full bg-primary-light text-primary flex items-center justify-center font-bold mb-4 shadow-sm">
          <Users size={28} />
        </div>
        <h2 className="text-2xl font-bold text-main tracking-tight">Your Network</h2>
        <p className="text-muted text-sm font-medium">Manage your Ekwly connections</p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-muted uppercase tracking-widest">
          Friends ({friends.length})
        </h3>
      </div>

      <div className="bg-surface border border-border rounded-2xl divide-y divide-border shadow-sm overflow-hidden flex flex-col">
        {friends.length === 0 ? (
          <div className="p-10 flex flex-col items-center justify-center text-center">
            <UserPlus size={32} className="text-muted opacity-40 mb-3" />
            <p className="text-main font-bold text-[0.95rem] mb-1">No friends yet</p>
            <p className="text-muted text-sm max-w-[200px]">
              Share your invite link from your profile to connect with people.
            </p>
          </div>
        ) : (
          friends.map((friend) => (
            <div
              key={friend.id}
              className="flex items-center justify-between p-4 bg-surface hover:bg-subtle transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold overflow-hidden shrink-0 border border-primary/20">
                  {friend.avatar_url ? (
                    <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User size={18} />
                  )}
                </div>
                <div className="flex flex-col min-w-0 pr-4">
                  <span className="font-semibold text-main text-[0.95rem] truncate">
                    {friend.name || 'Ekwly User'}
                  </span>
                  <span className="text-[0.75rem] font-medium text-muted truncate mt-0.5">
                    {friend.upi_id || 'No UPI ID linked'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleRemoveFriend(friend.id)}
                className="p-2 text-muted hover:text-danger hover:bg-danger/10 active:bg-danger/20 rounded-full transition-colors shrink-0"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
