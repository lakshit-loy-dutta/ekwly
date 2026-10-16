import { useState, useEffect, useCallback } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import QRCode from 'react-qr-code';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/utils';
import BottomSheet from './ui/BottomSheet';
import ConfirmSheet from './ui/ConfirmSheet';
import BrandLoader from './ui/BrandLoader';
import QrScannerModal from './ui/QrScannerModal';
import { User, Trash2, Users, UserPlus, QrCode, ScanLine, Share, Copy } from 'lucide-react';

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

export default function Friends({ user }: Props) {
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showMyQR, setShowMyQR] = useState(false);
  const [isScanningFriend, setIsScanningFriend] = useState(false);
  const [friendToRemove, setFriendToRemove] = useState<FriendProfile | null>(null);

  const friendLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?add_friend=${user?.id}`
      : '';

  const fetchFriends = useCallback(async () => {
    if (!user || user.is_anonymous) {
      setIsLoading(false);
      return;
    }

    const { data: connections } = await supabase
      .from('connections')
      .select('user_id, friend_id')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    if (!connections || connections.length === 0) {
      setFriends([]);
      setIsLoading(false);
      return;
    }

    const friendIds = connections.map((c) => (c.user_id === user.id ? c.friend_id : c.user_id));

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, avatar_url, upi_id')
      .in('id', friendIds);

    if (profiles) setFriends(profiles);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const handleScannedFriendUrl = async (scannedText: string) => {
    if (!user || user.is_anonymous) {
      return showToast('Sign in to add friends.', 'error');
    }
    let friendId: string | null = null;
    try {
      const url = new URL(scannedText);
      friendId = url.searchParams.get('add_friend');
    } catch {
      const queryPart = scannedText.split('?')[1] || '';
      friendId = new URLSearchParams(queryPart).get('add_friend');
    }

    if (!friendId) return showToast('Invalid Friend QR Code.', 'error');
    if (friendId === user.id) return showToast("You can't add yourself as a friend.", 'default');
    if (friends.some((f) => f.id === friendId)) {
      return showToast('Already in your friends network!', 'default');
    }

    const { error } = await supabase
      .from('connections')
      .insert({ user_id: user.id, friend_id: friendId });

    if (error) {
      showToast('Could not add friend.', 'error');
    } else {
      showToast('Friend added to your network!', 'success');
      fetchFriends();
    }
  };

  const confirmRemoveFriend = async () => {
    if (!friendToRemove) return;
    const friendId = friendToRemove.id;

    await supabase
      .from('connections')
      .delete()
      .or(
        `and(user_id.eq.${user?.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user?.id})`
      );

    setFriends((prev) => prev.filter((f) => f.id !== friendId));
    showToast('Friend removed.', 'success');
  };

  const handleShareLink = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Add me on Ekwly',
          text: 'Tap this link to add me as a friend on Ekwly so we can split bills!',
          url: friendLink,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(friendLink);
      showToast('Invite link copied to clipboard!', 'success');
    }
  };

  if (isLoading) {
    return <BrandLoader label="Loading Network..." fullScreen />;
  }

  return (
    <div className="w-full flex flex-col flex-1 px-4 py-6 md:px-8 bg-page pb-28">
      <QrScannerModal
        isOpen={isScanningFriend}
        title="Scan Friend QR"
        onClose={() => setIsScanningFriend(false)}
        onScanSuccess={handleScannedFriendUrl}
      />

      <ConfirmSheet
        isOpen={!!friendToRemove}
        onClose={() => setFriendToRemove(null)}
        onConfirm={confirmRemoveFriend}
        title="Remove Friend?"
        description={`Remove ${friendToRemove?.name || 'this user'} from your Ekwly connections?`}
        confirmLabel="Remove"
        variant="danger"
      />

      <div className="flex flex-col items-center mb-6 mt-2">
        <div className="w-16 h-16 rounded-full bg-primary-light text-primary flex items-center justify-center font-bold mb-4 shadow-sm">
          <Users size={28} />
        </div>
        <h2 className="text-2xl font-bold text-main tracking-tight">Your Network</h2>
        <p className="text-muted text-sm font-medium">Manage your Ekwly connections</p>
      </div>

      {/* CONNECT ACTIONS */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <button
          onClick={() => setShowMyQR(true)}
          className="bg-surface active:bg-subtle text-main border border-border hover:border-primary/50 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm transition-colors h-24"
        >
          <QrCode size={24} className="text-primary" strokeWidth={2.5} />
          <span className="font-semibold text-[0.95rem]">My QR Code</span>
        </button>
        <button
          onClick={() => setIsScanningFriend(true)}
          className="bg-surface active:bg-subtle text-main border border-border hover:border-primary/50 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm transition-colors h-24"
        >
          <ScanLine size={24} className="text-primary" strokeWidth={2.5} />
          <span className="font-semibold text-[0.95rem]">Scan Friend</span>
        </button>
        <button
          onClick={handleShareLink}
          className="col-span-2 bg-primary/10 active:bg-primary/20 text-primary border border-primary/20 rounded-xl p-3.5 flex items-center justify-center gap-2 shadow-sm transition-colors font-bold text-[0.95rem]"
        >
          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? (
            <Share size={18} />
          ) : (
            <Copy size={18} />
          )}
          Send Invite Link
        </button>
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
            <p className="text-muted text-sm max-w-50">
              Share your invite link above to connect with people.
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
                onClick={() => setFriendToRemove(friend)}
                className="p-2 text-muted hover:text-danger hover:bg-danger/10 active:bg-danger/20 rounded-full transition-colors shrink-0"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}
      </div>

      <BottomSheet isOpen={showMyQR} onClose={() => setShowMyQR(false)} title="My Friend Code">
        <div className="flex flex-col items-center">
          <p className="text-sm text-muted text-center mb-6">
            Have a friend scan this code to instantly add you to their Ekwly network.
          </p>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-border mb-6">
            <QRCode value={friendLink} size={220} />
          </div>
          <div className="bg-subtle border border-border rounded-xl px-6 py-3 w-full text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-muted mb-1">Friend ID</p>
            <p className="text-lg font-mono font-bold text-primary truncate">
              {user?.id.split('-')[0]}
            </p>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
