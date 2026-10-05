import { useState, useEffect } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import QRCode from 'react-qr-code';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/utils';
import BottomSheet from './ui/BottomSheet';
import {
  User,
  ShieldCheck,
  CreditCard,
  Mail,
  Smartphone,
  Loader2,
  Edit3,
  QrCode,
  ScanLine,
  Share,
  Copy,
} from 'lucide-react';

interface Props {
  user: SupabaseUser | null;
  onBack: () => void;
  isOnboarding?: boolean;
  onComplete?: () => void;
}

export default function Profile({ user, onBack, isOnboarding = false, onComplete }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(isOnboarding); // Force edit mode if onboarding
  const [isSaving, setIsSaving] = useState(false);
  const [showMyQR, setShowMyQR] = useState(false);

  const [name, setName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // The unique link friends can tap to add you without scanning
  const friendLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?add_friend=${user?.id}`
      : '';

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      // 1. Use maybeSingle() so it doesn't crash if the row doesn't exist yet
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

      // 2. Safely apply fallbacks from the DB first, then the Google OAuth Auth token
      setName(data?.name || user?.user_metadata?.full_name || user?.user_metadata?.name || '');
      setUpiId(data?.upi_id || '');
      setEmail(data?.email || user?.email || '');
      setPhone(data?.phone || user?.phone || '');

      setIsLoading(false);
    };
    fetchProfile();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!name.trim()) return showToast('Display name is required', 'error');

    setIsSaving(true);
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      name: name.trim(),
      upi_id: upiId.trim(),
      email: user.email,
      updated_at: new Date().toISOString(),
    });

    setIsSaving(false);
    if (error) {
      // PRO FIX: Output the actual DB error message so we aren't blind in production
      showToast(error.message || 'Failed to save profile', 'error');
    } else {
      showToast('Profile updated successfully', 'success');
      if (isOnboarding && onComplete) {
        onComplete();
      } else {
        setIsEditing(false);
      }
    }
  };

  const handleShareLink = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Add me on Ekwly',
          text: `Tap this link to add ${name || 'me'} as a friend on Ekwly so we can split bills!`,
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

  const handleDeleteAccount = async () => {
    const confirm1 = window.confirm(
      'Are you absolutely sure you want to delete your account? This action is permanent and cannot be undone.'
    );
    if (!confirm1) return;

    const confirm2 = window.prompt("Type 'DELETE' to confirm account closure.");
    if (confirm2 !== 'DELETE') return;

    setIsLoading(true);
    try {
      const { error } = await supabase.rpc('delete_user_account');
      if (error) throw error;

      await supabase.auth.signOut();
      showToast('Your account has been permanently deleted.', 'success');
      onBack(); // Send them back to the Auth screen
    } catch (err: any) {
      showToast(err.message || 'Failed to delete account.', 'error');
      setIsLoading(false);
    }
  };

  if (isLoading)
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Loader2 className="animate-spin text-primary opacity-50" size={32} />
      </div>
    );

  return (
    <div className="w-full flex flex-col flex-1 px-4 py-6 md:px-8 bg-page pb-24">
      <div className="flex flex-col items-center mb-6 mt-2">
        <div className="w-24 h-24 rounded-full bg-primary-light border-4 border-surface shadow-sm text-primary flex items-center justify-center font-bold overflow-hidden mb-4 relative">
          {user?.user_metadata?.avatar_url ? (
            <img
              src={user.user_metadata.avatar_url}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <User size={40} />
          )}
        </div>
        <h2 className="text-2xl font-bold text-main tracking-tight">{name || 'Guest User'}</h2>
        <p className="text-muted text-sm font-medium">Manage your identity and connections</p>
      </div>

      {/* Hide Share/QR actions during onboarding */}
      {!isOnboarding && (
        <div className="grid grid-cols-2 gap-3 mb-8">
          <button
            onClick={() => setShowMyQR(true)}
            className="bg-surface active:bg-subtle text-main border border-border hover:border-primary/50 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm transition-colors h-24"
          >
            <QrCode size={24} className="text-primary" strokeWidth={2.5} />
            <span className="font-semibold text-[0.95rem]">My QR Code</span>
          </button>
          <button
            onClick={() => showToast('Scanner initializing...', 'default')}
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
      )}

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-main">Personal Details</h3>
        {!isEditing && !isOnboarding && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm font-bold text-primary flex items-center gap-1.5 active:opacity-70"
          >
            <Edit3 size={16} /> Edit
          </button>
        )}
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-6 w-full">
        {/* Public Identity */}
        <div
          className={`bg-surface border rounded-2xl p-5 flex flex-col gap-4 shadow-sm transition-colors ${isEditing ? 'border-primary/50' : 'border-border'}`}
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-2">
              <User size={14} className={isEditing ? 'text-primary' : 'text-muted'} /> Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isEditing}
              placeholder="e.g. Rahul Sharma"
              className="w-full h-12 bg-transparent border-0 border-b border-border rounded-none px-0 font-medium focus:ring-0 focus:border-primary disabled:opacity-100 disabled:text-main"
              required
            />
          </div>
        </div>

        {/* Payment Configuration */}
        <div
          className={`bg-surface border rounded-2xl p-5 flex flex-col gap-4 shadow-sm transition-colors ${isEditing ? 'border-primary/50' : 'border-border'}`}
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-2">
              <CreditCard size={14} className={isEditing ? 'text-primary' : 'text-muted'} /> UPI ID
              (VPA)
            </label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              disabled={!isEditing}
              placeholder="e.g. rahul@okhdfcbank"
              className="w-full h-12 bg-transparent border-0 border-b border-border rounded-none px-0 font-medium focus:ring-0 focus:border-primary lowercase disabled:opacity-100 disabled:text-main"
            />
            {isEditing && (
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Adding this allows friends to tap a button and deep-link straight to GPay/PhonePe.
              </p>
            )}
          </div>
        </div>

        {/* Verified Credentials */}
        <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-sm opacity-80">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={18} className="text-muted" />
            <h3 className="font-bold text-main text-sm">Verified Credentials (Read-Only)</h3>
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
            <label className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-2">
              <Mail size={14} /> Email
            </label>
            <input
              type="text"
              value={email}
              disabled
              className="w-full h-10 bg-transparent border-0 px-0 font-medium text-muted cursor-not-allowed"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-2">
              <Smartphone size={14} /> Phone
            </label>
            <input
              type="text"
              value={phone}
              disabled
              placeholder="Not linked"
              className="w-full h-10 bg-transparent border-0 px-0 font-medium text-muted cursor-not-allowed"
            />
          </div>
        </div>

        {isEditing && (
          <div className="flex gap-3 mt-2">
            {!isOnboarding && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="h-14 flex-1 bg-surface text-main border border-border rounded-xl font-bold transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="h-14 flex-1 bg-primary active:bg-primary-hover text-white rounded-xl font-bold shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isSaving && <Loader2 size={18} className="animate-spin" />}
              {isOnboarding ? 'Complete Setup' : 'Save Changes'}
            </button>
          </div>
        )}

        {/* DANGER ZONE */}
        {!isOnboarding && !isEditing && (
          <div className="mt-8 pt-6 border-t border-border flex flex-col items-center">
            <button
              type="button"
              onClick={handleDeleteAccount}
              className="text-sm font-bold text-danger hover:text-danger/80 transition-colors"
            >
              Delete Account Permanently
            </button>
          </div>
        )}
      </form>

      {/* The Personal QR Modal */}
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
