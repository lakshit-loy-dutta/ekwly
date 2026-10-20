import { useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { showToast, utils } from '../lib/utils';
import { BrandLogo } from './ui/BrandLoader';
import {
  Mail,
  Loader2,
  Sparkles,
  Receipt,
  QrCode,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';

interface Props {
  onContinueAsGuest: () => void;
}

export default function Auth({ onContinueAsGuest }: Props) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [magicLinkSentTo, setMagicLinkSentTo] = useState<string | null>(null);

  const handleOAuth = async (provider: 'google') => {
    try {
      utils.haptic('light');
      setIsLoading(provider);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo:
            typeof window !== 'undefined'
              ? window.location.origin + window.location.pathname
              : undefined,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      showToast(error.message || 'Authentication failed', 'error');
      setIsLoading(null);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) return showToast('Enter a valid email', 'error');

    try {
      utils.haptic('light');
      setIsLoading('email');
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          emailRedirectTo:
            typeof window !== 'undefined'
              ? window.location.origin + window.location.pathname
              : undefined,
        },
      });
      if (error) throw error;
      setMagicLinkSentTo(cleanEmail);
      showToast('Magic link sent! Check your email.', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to send magic link', 'error');
    } finally {
      setIsLoading(null);
    }
  };

  const handleAnonymous = async () => {
    try {
      utils.haptic('medium');
      setIsLoading('anon');
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      onContinueAsGuest();
    } catch {
      showToast('Could not start guest session', 'error');
      setIsLoading(null);
    }
  };

  const container: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const item: Variants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 360, damping: 28 } },
  };

  return (
    <div className="flex flex-col flex-1 relative bg-page min-h-dvh">
      <div className="absolute inset-0 bg-grid-pattern z-0" />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col flex-1 px-6 justify-center items-center py-8 w-full max-w-sm mx-auto relative z-10"
      >
        {/* BRAND HERO & VALUE PROP PILLS */}
        <motion.div
          variants={item}
          className="flex flex-col items-center justify-center mb-8 mt-auto w-full text-center"
        >
          <div className="p-3 bg-surface border border-border shadow-xl rounded-3xl flex items-center justify-center mb-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-primary/10" />
            <BrandLogo size={52} className="relative z-10 rounded-2xl" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-main mb-1.5">Ekwly</h1>
          <p className="text-muted text-sm font-medium max-w-xs leading-relaxed mb-4">
            Split restaurant bills, route GST & liquor taxes, and settle via UPI in under 20
            seconds.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface border border-border text-[0.7rem] font-bold text-main shadow-2xs">
              <Sparkles size={11} className="text-primary" /> AI Bill Scan
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface border border-border text-[0.7rem] font-bold text-main shadow-2xs">
              <Receipt size={11} className="text-emerald-500" /> GST & VAT Routing
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface border border-border text-[0.7rem] font-bold text-main shadow-2xs">
              <QrCode size={11} className="text-amber-500" /> Instant UPI QR
            </span>
          </div>
        </motion.div>

        <motion.div variants={item} className="flex flex-col gap-3.5 w-full mb-auto">
          {/* Google Auth Button */}
          <button
            type="button"
            onClick={() => handleOAuth('google')}
            disabled={!!isLoading}
            className="w-full h-13 bg-surface text-main border border-border hover:border-primary/50 rounded-2xl shadow-sm flex items-center justify-center gap-3 font-bold text-sm transition-transform disabled:opacity-50 active:scale-[0.98]"
          >
            {isLoading === 'google' ? (
              <Loader2 className="animate-spin text-primary" size={20} />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.16C1.43 8.55 1 10.22 1 12s.43 3.45 1.16 4.93l3.68-2.84z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.16 7.07l3.68 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-0.5 opacity-60">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted">
              Or Email Link
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Email Auth Form OR Confirmation State */}
          {magicLinkSentTo ? (
            <div className="bg-surface border border-emerald-500/35 rounded-2xl p-4 flex flex-col items-center text-center gap-2 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 size={20} />
              </div>
              <p className="text-sm font-bold text-main">Check your inbox</p>
              <p className="text-xs text-muted leading-relaxed">
                We sent a 1-tap sign-in link to{' '}
                <strong className="text-main">{magicLinkSentTo}</strong>.
              </p>
              <button
                type="button"
                onClick={() => setMagicLinkSentTo(null)}
                className="mt-1 text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
              >
                <RotateCcw size={12} /> Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailAuth} className="flex flex-col gap-2.5">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full h-12 bg-surface border border-border rounded-2xl px-4 text-sm font-semibold text-main shadow-2xs"
              />
              <button
                type="submit"
                disabled={!!isLoading}
                className="w-full h-12 bg-primary hover:bg-primary-hover text-white rounded-2xl shadow-sm flex items-center justify-center gap-2 font-bold text-sm transition-transform disabled:opacity-50 active:scale-[0.98]"
              >
                {isLoading === 'email' ? (
                  <Loader2 className="animate-spin text-white" size={18} />
                ) : (
                  <Mail size={17} />
                )}
                Send Magic Link
              </button>
            </form>
          )}

          {/* Elevated Guest Quick-Start CTA */}
          <button
            type="button"
            onClick={handleAnonymous}
            disabled={!!isLoading}
            className="mt-2 w-full h-11 bg-surface/70 hover:bg-surface text-muted hover:text-main border border-border rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
          >
            {isLoading === 'anon' ? (
              <>
                <Loader2 size={14} className="animate-spin text-primary" /> Starting Workspace...
              </>
            ) : (
              <>
                Split a Bill Now as Guest <ArrowRight size={14} className="text-primary" />
              </>
            )}
          </button>
        </motion.div>

        {/* LEGAL FOOTER */}
        <motion.div variants={item} className="mt-6 text-center px-4">
          <p className="text-[0.7rem] text-muted/80 font-medium leading-relaxed">
            By continuing, you agree to Ekwly&apos;s <br />
            <a href={utils.resolvePath('terms')} className="text-primary hover:underline">
              Terms of Service
            </a>{' '}
            &{' '}
            <a href={utils.resolvePath('privacy')} className="text-primary hover:underline">
              Privacy Policy
            </a>
            .
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
