import { useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/utils';
import { Mail, ChevronRight, Loader2 } from 'lucide-react';

interface Props {
  onContinueAsGuest: () => void;
}

export default function Auth({ onContinueAsGuest }: Props) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleOAuth = async (provider: 'google') => {
    try {
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
    if (!email || !email.includes('@')) return showToast('Enter a valid email', 'error');

    try {
      setIsLoading('email');
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo:
            typeof window !== 'undefined'
              ? window.location.origin + window.location.pathname
              : undefined,
        },
      });
      if (error) throw error;
      showToast('Magic link sent! Check your email.', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to send magic link', 'error');
    } finally {
      setIsLoading(null);
    }
  };

  const handleAnonymous = async () => {
    try {
      setIsLoading('anon');
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      onContinueAsGuest();
    } catch (error: any) {
      showToast('Could not start guest session', 'error');
      setIsLoading(null);
    }
  };

  // Framer Motion Animation Variants
  const container: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const item: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
  };

  return (
    <div className="flex flex-col flex-1 relative bg-page min-h-dvh">
      {/* GLOBAL TEXTURE */}
      <div className="absolute inset-0 bg-grid-pattern z-0"></div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col flex-1 px-6 justify-center items-center py-8 w-full max-w-sm mx-auto relative z-10"
      >
        {/* LOGO & HERO */}
        <motion.div
          variants={item}
          className="flex flex-col items-center justify-center mb-10 mt-auto w-full"
        >
          <div className="w-20 h-20 bg-surface border border-border shadow-xl rounded-3xl flex items-center justify-center mb-6 relative overflow-hidden">
            <div className="absolute inset-0 premium-gradient-card opacity-20"></div>
            <img
              src="./icon.svg"
              width="48"
              height="48"
              alt="Ekwly Logo"
              className="relative z-10 rounded-xl"
            />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-main mb-2">Ekwly</h2>
          <p className="text-muted text-center text-[0.95rem] font-medium">
            Split fairer, together.
          </p>
        </motion.div>

        <motion.div variants={item} className="flex flex-col gap-4 w-full mb-auto">
          {/* Google Auth Button */}
          <button
            onClick={() => handleOAuth('google')}
            disabled={!!isLoading}
            className="w-full h-14 bg-surface/80 backdrop-blur-md text-main border border-border hover:border-primary/50 rounded-2xl shadow-sm flex items-center justify-center gap-3 font-bold transition-all disabled:opacity-50 active:scale-[0.98]"
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

          <div className="flex items-center gap-4 my-1 opacity-60">
            <div className="flex-1 h-px bg-border"></div>
            <span className="text-xs font-bold uppercase tracking-widest text-muted">Or</span>
            <div className="flex-1 h-px bg-border"></div>
          </div>

          {/* Email Auth Form */}
          <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              className="w-full h-14 bg-surface/80 backdrop-blur-md border border-border rounded-2xl px-4 font-medium text-main focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
            />
            <button
              type="submit"
              disabled={!!isLoading}
              className="w-full h-14 bg-main text-surface active:bg-main/90 rounded-2xl shadow-md flex items-center justify-center gap-2 font-bold transition-all disabled:opacity-50 active:scale-[0.98]"
            >
              {isLoading === 'email' ? (
                <Loader2 className="animate-spin text-surface" size={20} />
              ) : (
                <Mail size={18} />
              )}
              Send Magic Link
            </button>
          </form>

          <button
            onClick={handleAnonymous}
            disabled={!!isLoading}
            className="mt-4 text-sm font-bold text-muted hover:text-main flex items-center justify-center gap-1 transition-colors"
          >
            {isLoading === 'anon' ? 'Creating Session...' : 'Sign in later as Guest'}{' '}
            <ChevronRight size={16} />
          </button>
        </motion.div>

        {/* LEGAL FOOTER */}
        <motion.div variants={item} className="mt-8 text-center px-4">
          <p className="text-[0.7rem] text-muted/80 font-medium leading-relaxed">
            By continuing, you agree to Ekwly's <br />
            <a href="/ekwly/terms" className="text-primary hover:underline">
              Terms of Service
            </a>{' '}
            &{' '}
            <a href="/ekwly/privacy" className="text-primary hover:underline">
              Privacy Policy
            </a>
            .
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
