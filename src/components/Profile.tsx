import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/utils';
import { User, ShieldCheck, CreditCard, Mail, Smartphone, Loader2 } from 'lucide-react';

interface Props {
  user: any;
  onBack: () => void;
}

export default function Profile({ user, onBack }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        setName(data.name || '');
        setUpiId(data.upi_id || '');
        setEmail(data.email || user.email || '');
        setPhone(data.phone || '');
      }
      setIsLoading(false);
    };

    fetchProfile();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return showToast('Display name is required', 'error');

    setIsSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        name: name.trim(),
        upi_id: upiId.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    setIsSaving(false);

    if (error) {
      showToast('Failed to save profile', 'error');
    } else {
      showToast('Profile updated successfully', 'success');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Loader2 className="animate-spin text-primary opacity-50" size={32} />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col flex-1 px-4 py-6 md:px-8 bg-page pb-24">
      <div className="flex flex-col items-center mb-8 mt-4">
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
        <p className="text-muted text-sm font-medium">Manage your identity and payments</p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-6 w-full">
        {/* Public Identity */}
        <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <User size={18} className="text-primary" />
            <h3 className="font-bold text-main">Public Identity</h3>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full h-12 bg-page border border-border rounded-xl px-4 font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
              required
            />
          </div>
        </div>

        {/* Payment Configuration */}
        <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard size={18} className="text-primary" />
            <h3 className="font-bold text-main">Payment Details</h3>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">
              UPI ID (VPA)
            </label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g. rahul@okhdfcbank"
              className="w-full h-12 bg-page border border-border rounded-xl px-4 font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary lowercase"
            />
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Adding this allows friends to tap a button and deep-link straight to GPay/PhonePe to
              settle debts with you.
            </p>
          </div>
        </div>

        {/* Verified Credentials (Read-Only/Disabled for now) */}
        <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-sm opacity-80">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={18} className="text-primary" />
            <h3 className="font-bold text-main">Verified Credentials</h3>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-2">
              <Mail size={14} /> Email Address
            </label>
            <input
              type="text"
              value={email}
              disabled
              placeholder="No email linked"
              className="w-full h-12 bg-page border border-border rounded-xl px-4 font-medium text-muted cursor-not-allowed"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-2">
              <Smartphone size={14} /> Phone Number
            </label>
            <input
              type="text"
              value={phone}
              disabled
              placeholder="Coming soon..."
              className="w-full h-12 bg-page border border-border rounded-xl px-4 font-medium text-muted cursor-not-allowed"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="h-14 mt-2 w-full bg-primary active:bg-primary-hover text-white rounded-xl font-bold shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
        >
          {isSaving && <Loader2 size={18} className="animate-spin" />}
          Save Profile
        </button>
      </form>
    </div>
  );
}
