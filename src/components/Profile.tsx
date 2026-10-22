import { useState, useEffect } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import QRCode from 'react-qr-code';
import { supabase } from '../lib/supabase';
import { swrCache } from '../lib/swrCache';
import { showToast, utils } from '../lib/utils';
import BottomSheet from './ui/BottomSheet';
import ConfirmSheet from './ui/ConfirmSheet';
import BrandLoader from './ui/BrandLoader';
import {
  User,
  ShieldCheck,
  CreditCard,
  Mail,
  Smartphone,
  Loader2,
  Edit3,
  QrCode,
  CheckCircle2,
  Trash2,
} from 'lucide-react';

interface CachedProfileData {
  name: string;
  upiId: string;
  email: string;
  phone: string;
}

interface Props {
  user: SupabaseUser | null;
  onBack: () => void;
  isOnboarding?: boolean;
  onComplete?: () => void;
}

export default function Profile({ user, onBack, isOnboarding = false, onComplete }: Props) {
  const cacheKey = `profile_${user?.id || 'guest'}`;
  const cached = swrCache.get<CachedProfileData>(cacheKey);

  const [isLoading, setIsLoading] = useState(!cached);
  const [isEditing, setIsEditing] = useState(isOnboarding);
  const [isSaving, setIsSaving] = useState(false);
  const [showUpiQrPreview, setShowUpiQrPreview] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [name, setName] = useState(cached?.name || '');
  const [upiId, setUpiId] = useState(cached?.upiId || '');
  const [email, setEmail] = useState(cached?.email || '');
  const [phone, setPhone] = useState(cached?.phone || '');

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

      const rawName =
        data?.name || user?.user_metadata?.full_name || user?.user_metadata?.name || '';
      const cleanName = /^Guest\s+[0-9a-f]{5}$/i.test(rawName) ? '' : rawName;
      const resolvedUpi = data?.upi_id || '';
      const resolvedEmail = data?.email || user?.email || '';
      const resolvedPhone = data?.phone || user?.phone || '';

      setName(cleanName);
      setUpiId(resolvedUpi);
      setEmail(resolvedEmail);
      setPhone(resolvedPhone);

      swrCache.set<CachedProfileData>(cacheKey, {
        name: cleanName,
        upiId: resolvedUpi,
        email: resolvedEmail,
        phone: resolvedPhone,
      });

      setIsLoading(false);
    };
    fetchProfile();
  }, [user, cacheKey]);

  const executeAccountDeletion = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.rpc('delete_user_account');
      if (error) throw error;
      swrCache.clearAll();
      await supabase.auth.signOut();
      showToast('Your account has been permanently deleted.', 'success');
      onBack();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete account.', 'error');
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const trimmedName = name.trim();
    const trimmedUpi = upiId.trim().toLowerCase();
    if (!trimmedName) return showToast('Display name is required', 'error');

    setIsSaving(true);
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      name: trimmedName,
      upi_id: trimmedUpi,
      email: user.email,
      updated_at: new Date().toISOString(),
    });

    setIsSaving(false);
    if (error) {
      showToast(error.message || 'Failed to save profile', 'error');
    } else {
      utils.haptic('medium');
      setName(trimmedName);
      setUpiId(trimmedUpi);
      swrCache.set<CachedProfileData>(cacheKey, {
        name: trimmedName,
        upiId: trimmedUpi,
        email,
        phone,
      });
      showToast('Profile updated successfully', 'success');
      if (isOnboarding && onComplete) {
        onComplete();
      } else {
        setIsEditing(false);
      }
    }
  };

  if (isLoading) {
    return <BrandLoader label="Loading Profile..." fullScreen />;
  }

  const personalUpiUri = upiId.trim()
    ? `upi://pay?pa=${encodeURIComponent(upiId.trim())}&pn=${encodeURIComponent(name.trim() || 'Ekwly User')}&cu=INR`
    : '';

  return (
    <div className="w-full flex flex-col flex-1 px-4 py-6 md:px-8 bg-page pb-28">
      <ConfirmSheet
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={executeAccountDeletion}
        title="Delete Account Permanently"
        description="This action permanently wipes your Ekwly profile, friend connections, and personal ledger records. It cannot be undone."
        confirmLabel="Delete Forever"
        variant="danger"
        requireMatchText="DELETE"
      />

      {/* PROFILE IDENTITY HERO */}
      <div className="flex flex-col items-center mb-6 mt-1 text-center">
        <div className="w-20 h-20 rounded-3xl bg-primary-light border-2 border-primary/25 shadow-sm text-primary flex items-center justify-center font-bold overflow-hidden mb-3 relative">
          {user?.user_metadata?.avatar_url ? (
            <img
              src={user.user_metadata.avatar_url}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <User size={36} />
          )}
        </div>
        <h2 className="text-2xl font-extrabold text-main tracking-tight">
          {name || (isOnboarding ? 'Welcome to Ekwly' : 'Guest User')}
        </h2>
        <p className="text-muted text-xs sm:text-sm font-medium mt-0.5">
          {isOnboarding
            ? 'Set your name and optional UPI ID to get started'
            : 'Manage your display identity and instant UPI settlement ID'}
        </p>
      </div>

      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-xs font-bold text-muted uppercase tracking-widest">
          Identity &amp; UPI Settings
        </h3>
        {!isEditing && !isOnboarding && (
          <button
            type="button"
            onClick={() => {
              utils.haptic('light');
              setIsEditing(true);
            }}
            className="text-xs font-bold text-primary flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
          >
            <Edit3 size={13} /> Edit Details
          </button>
        )}
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-4 w-full">
        {/* Public Identity Card */}
        <div
          className={`bg-surface border rounded-2xl p-4 flex flex-col gap-2 shadow-sm transition-colors ${
            isEditing ? 'border-primary/50' : 'border-border'
          }`}
        >
          <label className="text-[0.7rem] font-bold text-muted uppercase tracking-widest flex items-center gap-1.5">
            <User size={13} className={isEditing ? 'text-primary' : 'text-muted'} /> Display Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isEditing}
            placeholder="e.g. Rahul Sharma"
            className="w-full h-11 bg-page border border-border rounded-xl px-3.5 font-semibold text-main disabled:opacity-90"
            required
          />
        </div>

        {/* UPI Payment Configuration Card */}
        <div
          className={`bg-surface border rounded-2xl p-4 flex flex-col gap-3 shadow-sm transition-colors ${
            isEditing ? 'border-primary/50' : 'border-border'
          }`}
        >
          <div className="flex items-center justify-between">
            <label className="text-[0.7rem] font-bold text-muted uppercase tracking-widest flex items-center gap-1.5">
              <CreditCard size={13} className={isEditing ? 'text-primary' : 'text-muted'} /> UPI ID
              (VPA for Receiving Money)
            </label>
            {upiId.trim().includes('@') && (
              <span className="inline-flex items-center gap-1 text-[0.65rem] font-bold text-emerald-500 bg-emerald-500/12 px-2 py-0.5 rounded-full">
                <CheckCircle2 size={11} /> Active
              </span>
            )}
          </div>

          <input
            type="text"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            disabled={!isEditing}
            placeholder="e.g. rahul@okhdfcbank"
            className="w-full h-11 bg-page border border-border rounded-xl px-3.5 font-mono font-semibold text-main lowercase disabled:opacity-90"
          />

          <p className="text-xs text-muted leading-relaxed">
            Powers 1-tap GPay/PhonePe links and dynamic table UPI QR codes when friends owe you.
          </p>

          {!isEditing && upiId.trim().includes('@') && (
            <button
              type="button"
              onClick={() => {
                utils.haptic('light');
                setShowUpiQrPreview(true);
              }}
              className="h-10 w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <QrCode size={15} /> Preview My UPI Receive QR
            </button>
          )}
        </div>

        {isEditing && (
          <div className="flex gap-3 mt-1">
            {!isOnboarding && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="h-12 flex-1 bg-surface text-main border border-border rounded-xl font-bold text-sm transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="h-12 flex-1 bg-primary hover:bg-primary-hover active:scale-95 text-white rounded-xl font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isSaving && <Loader2 size={16} className="animate-spin" />}
              {isOnboarding ? 'Complete Setup' : 'Save Changes'}
            </button>
          </div>
        )}

        {/* Verified Credentials (Read-Only) */}
        {!isOnboarding && (
          <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-3 shadow-sm mt-2">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-primary" />
              <h3 className="font-bold text-main text-xs uppercase tracking-widest">
                Linked Account Credentials
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="bg-page border border-border rounded-xl p-3 flex flex-col gap-1">
                <span className="text-[0.65rem] font-bold text-muted uppercase tracking-widest flex items-center gap-1.5">
                  <Mail size={12} /> Email
                </span>
                <span className="text-xs font-semibold text-main truncate">
                  {email || 'Anonymous Guest'}
                </span>
              </div>
              <div className="bg-page border border-border rounded-xl p-3 flex flex-col gap-1">
                <span className="text-[0.65rem] font-bold text-muted uppercase tracking-widest flex items-center gap-1.5">
                  <Smartphone size={12} /> Phone
                </span>
                <span className="text-xs font-semibold text-main truncate">
                  {phone || 'Not linked'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* DANGER ZONE */}
        {!isOnboarding && !isEditing && (
          <div className="mt-6 pt-5 border-t border-border flex flex-col items-center">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-xs font-bold text-danger hover:text-danger/80 flex items-center gap-1.5 py-2 px-4 rounded-xl hover:bg-danger/10 transition-colors"
            >
              <Trash2 size={14} /> Delete Account Permanently
            </button>
          </div>
        )}
      </form>

      {/* PERSONAL UPI RECEIVE QR MODAL */}
      <BottomSheet
        isOpen={showUpiQrPreview}
        onClose={() => setShowUpiQrPreview(false)}
        title="My UPI Receive QR"
      >
        <div className="flex flex-col items-center pb-4">
          <p className="text-xs text-muted text-center mb-5 max-w-xs leading-relaxed">
            Anyone can scan this QR with GPay, PhonePe, or Paytm to pay{' '}
            <strong className="text-main">{name || 'you'}</strong> directly.
          </p>
          {personalUpiUri && (
            <div className="bg-white p-5 rounded-3xl shadow-md border border-border mb-4">
              <QRCode value={personalUpiUri} size={210} />
            </div>
          )}
          <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg">
            {upiId}
          </span>
        </div>
      </BottomSheet>
    </div>
  );
}
