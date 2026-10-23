import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { User } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import QRCode from 'react-qr-code';
import { supabase } from '../lib/supabase';
import { swrCache } from '../lib/swrCache';
import { showToast, utils } from '../lib/utils';
import type { SavedSquad } from '../lib/types';
import Auth from './Auth';
import BottomSheet from './ui/BottomSheet';
import BottomDock, { type DockTab } from './ui/BottomDock';
import BrandLoader, { BrandWordmark } from './ui/BrandLoader';
import SpotlightTour from './ui/SpotlightTour';
import ProUpgradeSheet from './ui/ProUpgradeSheet';
import {
  ChevronLeft,
  Sun,
  Moon,
  LogOut,
  User as UserIcon,
  QrCode,
  Edit3,
  Share,
  Copy,
  Sparkles,
  WifiOff,
  HelpCircle,
} from 'lucide-react';

const Home = lazy(() => import('./Home'));
const Lobby = lazy(() => import('./Lobby'));
const ActiveSession = lazy(() => import('./ActiveSession'));
const Profile = lazy(() => import('./Profile'));
const Friends = lazy(() => import('./Friends'));
const Ledger = lazy(() => import('./Ledger'));
const Analytics = lazy(() => import('./Analytics'));

type ViewState =
  'auth' | 'home' | 'lobby' | 'session' | 'profile' | 'friends' | 'ledger' | 'analytics';

export default function AppRouter() {
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [currentView, setCurrentView] = useState<ViewState>('auth');
  const [lobbyMode, setLobbyMode] = useState<'create' | 'join'>('create');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSessionPin, setActiveSessionPin] = useState<string | null>(null);
  const [activeSessionName, setActiveSessionName] = useState<string | null>(null);
  const [isHost, setIsHost] = useState<boolean>(false);
  const [isOnboarding, setIsOnboarding] = useState<boolean>(false);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showProSheet, setShowProSheet] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [user, setUser] = useState<User | null>(null);
  const [isDark, setIsDark] = useState<boolean>(false);

  const viewRef = useRef(currentView);
  viewRef.current = currentView;

  const modalsRef = useRef({ isProfileOpen, showInviteModal, showTour, showProSheet });
  modalsRef.current = { isProfileOpen, showInviteModal, showTour, showProSheet };

  // Synchronizes concurrent getSession() and onAuthStateChange() calls so isAuthChecking
  // never flips to false before the initial routing promise resolves.
  const routingPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!isAuthChecking && currentView === 'home' && typeof window !== 'undefined') {
      const completed = localStorage.getItem('ekwly_tour_completed_v1');
      if (!completed) {
        const timer = setTimeout(() => setShowTour(true), 400);
        return () => clearTimeout(timer);
      }
    }
  }, [isAuthChecking, currentView]);

  useEffect(() => {
    if (!user || user.is_anonymous || typeof window === 'undefined') return;
    const lastPruned = Number(localStorage.getItem('ekwly_last_prune_ts') || 0);
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - lastPruned > sevenDaysMs) {
      localStorage.setItem('ekwly_last_prune_ts', String(Date.now()));
      supabase.rpc('prune_stale_data').then(() => {});
    }
  }, [user]);

  useEffect(() => {
    const checkUserOnboardingAndLinks = async (currentUser: User) => {
      const urlParams = new URLSearchParams(window.location.search);
      const friendToAdd = urlParams.get('add_friend');

      if (friendToAdd && friendToAdd !== currentUser.id) {
        const { error } = await supabase.from('connections').insert({
          user_id: currentUser.id,
          friend_id: friendToAdd,
        });
        if (!error) showToast('Friend added to your network!', 'success');
        window.history.replaceState({}, '', window.location.pathname);
      }

      if (currentUser.is_anonymous) {
        setIsOnboarding(false);
        return false;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('upi_id')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (!profile || !profile.upi_id) {
        setIsOnboarding(true);
        return true;
      }
      setIsOnboarding(false);
      return false;
    };

    const routeAuthenticatedSession = async (sessionUser: User) => {
      setUser(sessionUser);

      if (routingPromiseRef.current) {
        await routingPromiseRef.current;
        setIsAuthChecking(false);
        return;
      }

      routingPromiseRef.current = (async () => {
        try {
          const needsOnboarding = await checkUserOnboardingAndLinks(sessionUser);
          const urlParams = new URLSearchParams(window.location.search);
          const sId = urlParams.get('s');
          const pin = urlParams.get('p');

          if (sId && pin) {
            const { data: isValid } = await supabase.rpc('verify_session_pin', {
              p_session_id: sId,
              p_pin: pin,
            });
            if (isValid) {
              setActiveSessionId(sId);
              setActiveSessionPin(pin);
              setIsHost(localStorage.getItem('ekwly_host_' + sId) === 'true');
              setCurrentView('session');
              window.history.replaceState({ view: 'session' }, '', window.location.search);
              return;
            } else {
              showToast('Invalid Room ID or PIN.', 'error');
              window.history.replaceState({ view: 'home' }, '', window.location.pathname);
            }
          }

          if (needsOnboarding) {
            setCurrentView('profile');
            window.history.replaceState({ view: 'profile' }, '', window.location.pathname);
          } else {
            setCurrentView('home');
            window.history.replaceState({ view: 'home' }, '', window.location.pathname);
          }
        } finally {
          setIsAuthChecking(false);
        }
      })();

      await routingPromiseRef.current;
    };

    setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        routeAuthenticatedSession(session.user);
      } else {
        setIsAuthChecking(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await routeAuthenticatedSession(session.user);
      } else {
        routingPromiseRef.current = null;
        setUser(null);
        setCurrentView('auth');
        setIsAuthChecking(false);
        window.history.replaceState({ view: 'auth' }, '', window.location.pathname);
      }
    });

    const handlePopState = (e: PopStateEvent) => {
      if (modalsRef.current.isProfileOpen) {
        setIsProfileOpen(false);
        return;
      }
      if (modalsRef.current.showInviteModal) {
        setShowInviteModal(false);
        return;
      }
      if (modalsRef.current.showTour) {
        setShowTour(false);
        return;
      }
      if (modalsRef.current.showProSheet) {
        setShowProSheet(false);
        return;
      }
      if (e.state && e.state.view) {
        setCurrentView(e.state.view);
      } else if (user) {
        setCurrentView('home');
      } else {
        setCurrentView('auth');
      }
    };
    window.addEventListener('popstate', handlePopState);

    let backButtonListener: any;
    if (Capacitor.isNativePlatform()) {
      backButtonListener = CapApp.addListener('backButton', () => {
        if (modalsRef.current.isProfileOpen) {
          setIsProfileOpen(false);
        } else if (modalsRef.current.showInviteModal) {
          setShowInviteModal(false);
        } else if (modalsRef.current.showTour) {
          setShowTour(false);
        } else if (modalsRef.current.showProSheet) {
          setShowProSheet(false);
        } else if (viewRef.current !== 'home' && viewRef.current !== 'auth') {
          window.history.back();
        } else {
          CapApp.exitApp();
        }
      });
    }

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('popstate', handlePopState);
      if (backButtonListener) backButtonListener.remove();
    };
  }, []);

  const navigateTo = (view: ViewState, urlSearch = '') => {
    const targetPath = urlSearch ? urlSearch : window.location.pathname;
    window.history.pushState({ view }, '', targetPath);
    setCurrentView(view);
  };

  const handleToggleTheme = () => {
    utils.haptic('light');
    if (typeof window !== 'undefined' && window.toggleTheme) {
      window.toggleTheme();
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    }
  };

  const handleInstantCreateSession = (customInitialName?: string | null) => {
    const newId = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();
    localStorage.setItem('ekwly_host_' + newId, 'true');
    localStorage.setItem('ekwly_pin_' + newId, generatedPin);
    setActiveSessionId(newId);
    setActiveSessionPin(generatedPin);
    setActiveSessionName(customInitialName || null);
    setIsHost(true);
    navigateTo('session', `?s=${newId}&p=${generatedPin}`);
    return newId;
  };

  // 1-Tap Launch with a Saved Squad directly from the Home Dashboard
  const handleLaunchSquadSession = (squad: SavedSquad) => {
    const newId = handleInstantCreateSession(`${squad.name} Split`);
    localStorage.setItem(`ekwly_pending_squad_${newId}`, JSON.stringify(squad.members));
  };

  const handleOpenLobby = (mode: 'create' | 'join', customTitle?: string) => {
    if (mode === 'create') {
      handleInstantCreateSession(customTitle || null);
      return;
    }
    setLobbyMode('join');
    navigateTo('lobby');
  };

  const handleJoinSession = async (id: string, pin: string) => {
    const { data: isValid } = await supabase.rpc('verify_session_pin', {
      p_session_id: id,
      p_pin: pin,
    });
    if (isValid) {
      localStorage.setItem('ekwly_pin_' + id, pin);
      setActiveSessionId(id);
      setActiveSessionPin(pin);
      setActiveSessionName(null);
      setIsHost(localStorage.getItem('ekwly_host_' + id) === 'true');
      navigateTo('session', `?s=${id}&p=${pin}`);
    } else {
      showToast('Invalid Room ID or PIN!', 'error');
    }
  };

  const handleLeaveSession = () => {
    swrCache.invalidate('home_');
    swrCache.invalidate('ledger_');
    swrCache.invalidate('analytics_');
    window.history.pushState({ view: 'home' }, '', window.location.pathname);
    setActiveSessionId(null);
    setActiveSessionPin(null);
    setActiveSessionName(null);
    setIsHost(false);
    setCurrentView('home');
  };

  const handleSignOut = async () => {
    swrCache.clearAll();
    routingPromiseRef.current = null;
    await supabase.auth.signOut();
    setIsProfileOpen(false);
    setCurrentView('auth');
    window.history.replaceState({}, '', window.location.pathname);
  };

  const handleSelectDockTab = (tab: DockTab) => {
    if (tab !== currentView) {
      navigateTo(tab);
    }
  };

  const isSubView =
    currentView === 'session' ||
    currentView === 'profile' ||
    currentView === 'friends' ||
    currentView === 'ledger' ||
    currentView === 'analytics';

  const showBottomDock =
    !isAuthChecking &&
    !isOnboarding &&
    (currentView === 'home' ||
      currentView === 'ledger' ||
      currentView === 'friends' ||
      currentView === 'analytics' ||
      currentView === 'profile');

  const getHeaderTitle = () => {
    if (currentView === 'profile') return isOnboarding ? 'Complete Setup' : 'Your Profile';
    if (currentView === 'friends') return 'Dining Network';
    if (currentView === 'ledger') return 'Global Ledger';
    if (currentView === 'analytics') return 'Personal Insights';
    return 'Split Workbench';
  };

  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?s=${activeSessionId}&p=${activeSessionPin}`
      : '';

  const handleShareInvite = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Join my Ekwly Split!',
          text: `Tap to join my live bill split on Ekwly (PIN: ${activeSessionPin}):`,
          url: inviteUrl,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(inviteUrl);
      showToast('Invite link copied to clipboard!', 'success');
    }
  };

  // Strict Boot Guard: Never allow <Auth /> to flash if auth is checking OR if a user object is present
  if (isAuthChecking || (user && currentView === 'auth')) {
    return (
      <div className="w-full max-w-2xl mx-auto bg-page min-h-dvh flex items-center justify-center">
        <BrandLoader state="lockin" label="Starting Ekwly..." fullScreen />
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto bg-page relative md:shadow-stripe md:border-x md:border-border min-h-screen md:min-h-[calc(100vh-64px)] flex flex-col overflow-x-clip no-scrollbar">
      <SpotlightTour
        isOpen={showTour}
        onClose={() => setShowTour(false)}
        onOpenProPlans={() => setShowProSheet(true)}
      />

      <ProUpgradeSheet
        isOpen={showProSheet}
        onClose={() => setShowProSheet(false)}
        userId={user?.id}
        userEmail={user?.email}
        userName={user?.user_metadata?.full_name}
      />

      {/* STICKY GLASSMORPHIC HEADER */}
      {currentView !== 'auth' && currentView !== 'lobby' && (
        <header className="w-full h-16 px-4 glass-chrome border-b border-border flex items-center justify-between sticky top-0 z-40 transition-colors duration-200 gpu-layer">
          {isSubView ? (
            <div className="flex items-center gap-1 min-w-0">
              {!isOnboarding && (
                <button
                  type="button"
                  onClick={
                    currentView === 'session' ? handleLeaveSession : () => navigateTo('home')
                  }
                  className="p-2 -ml-2 rounded-full text-primary hover:bg-subtle active:bg-border transition-colors shrink-0"
                  aria-label="Go Back"
                >
                  <ChevronLeft size={24} />
                </button>
              )}
              <span className="font-bold text-main text-[1.05rem] tracking-tight truncate">
                {getHeaderTitle()}
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleSelectDockTab('home')}
              className="flex items-center py-1 active:scale-95 transition-transform"
              aria-label="Ekwly Home"
            >
              <BrandWordmark height={28} />
            </button>
          )}

          <div className="flex items-center gap-2">
            {!isOnline && (
              <span
                className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-500 text-[0.65rem] font-extrabold uppercase tracking-wider flex items-center gap-1"
                title="Offline Mode — All changes are safely queued on your device and will sync automatically when back online."
              >
                <WifiOff size={12} /> Offline
              </span>
            )}

            {currentView === 'home' && (
              <button
                type="button"
                onClick={() => {
                  utils.haptic('light');
                  setShowTour(true);
                }}
                className="px-2.5 py-1.5 rounded-full glass-pill text-primary text-xs font-bold flex items-center gap-1 hover:bg-primary/15 transition-colors"
                title="Open App Guide & Tutorial"
              >
                <HelpCircle size={14} />
                <span className="hidden xs:inline">Guide</span>
              </button>
            )}

            {currentView === 'session' && (
              <button
                type="button"
                onClick={() => {
                  utils.haptic('light');
                  if (typeof window !== 'undefined' && activeSessionId) {
                    window.dispatchEvent(
                      new CustomEvent('ekwly:enable-realtime', {
                        detail: { sessionId: activeSessionId },
                      })
                    );
                  }
                  setShowInviteModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 glass-pill text-primary hover:bg-primary/20 rounded-full text-xs font-bold tracking-wider uppercase transition-colors"
              >
                <QrCode size={15} />
                <span>Invite QR</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleToggleTheme}
              aria-label="Toggle Theme"
              className="p-2 rounded-full text-muted hover:text-main hover:bg-subtle transition-colors"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <button
              type="button"
              onClick={() => {
                utils.haptic('light');
                setIsProfileOpen(true);
              }}
              aria-label="Account Settings"
              className="w-9 h-9 rounded-full bg-primary-light border border-primary/20 text-primary flex items-center justify-center font-bold overflow-hidden hover:opacity-90 transition-opacity shrink-0"
            >
              {user?.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserIcon size={18} />
              )}
            </button>
          </div>
        </header>
      )}

      {/* INVITE QR SHEET */}
      <BottomSheet
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite to Table"
      >
        <div className="flex flex-col items-center">
          <p className="text-sm text-muted text-center mb-6">
            Have your friends scan this QR code to join the live session, or share the direct link
            below.
          </p>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-border mb-6">
            <QRCode value={inviteUrl} size={200} />
          </div>

          <button
            type="button"
            onClick={handleShareInvite}
            className="w-full min-h-12 mb-6 bg-primary/10 active:bg-primary/20 text-primary border border-primary/20 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-2xs"
          >
            {typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? (
              <Share size={18} />
            ) : (
              <Copy size={18} />
            )}
            Share Room Link
          </button>

          <div className="flex gap-4 w-full">
            <div className="flex-1 bg-subtle border border-border rounded-xl p-3 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-muted mb-1">Room ID</p>
              <p className="text-base font-mono font-bold text-main truncate">{activeSessionId}</p>
            </div>
            <div className="flex-1 bg-subtle border border-border rounded-xl p-3 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-muted mb-1">
                Room PIN
              </p>
              <p className="text-base font-mono font-bold text-primary tracking-widest tabular-nums">
                {activeSessionPin}
              </p>
            </div>
          </div>
        </div>
      </BottomSheet>

      {/* ACCOUNT SETTINGS SHEET */}
      <BottomSheet
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        title="Account Settings"
      >
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between p-4 bg-page rounded-2xl border border-border">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold overflow-hidden shrink-0 border border-primary/20">
                {user?.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserIcon size={28} />
                )}
              </div>
              <div className="flex flex-col min-w-0 pr-2">
                <span className="font-bold text-main text-base truncate">
                  {user?.user_metadata?.full_name || 'Guest User'}
                </span>
                <span className="text-muted text-sm truncate">
                  {user?.email || 'Anonymous Session'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsProfileOpen(false);
                navigateTo('profile');
              }}
              className="p-2.5 bg-surface text-primary border border-border rounded-xl hover:bg-subtle transition-colors shadow-2xs shrink-0"
              aria-label="Edit Profile"
            >
              <Edit3 size={18} />
            </button>
          </div>

          <div className="flex flex-col gap-2.5">
            {user?.is_anonymous && (
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full min-h-12 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors text-sm"
              >
                <Sparkles size={17} /> Link Google or Email Account
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                utils.haptic('light');
                setIsProfileOpen(false);
                setShowTour(true);
              }}
              className="w-full min-h-11 bg-page hover:bg-subtle text-main border border-border rounded-xl font-bold flex items-center justify-center gap-2 transition-colors text-xs"
            >
              <HelpCircle size={16} className="text-primary" /> Replay Interactive App Guide
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="w-full min-h-12 bg-danger/10 hover:bg-danger/20 text-danger rounded-xl font-bold flex items-center justify-center gap-2 transition-colors text-sm"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>

          <div className="pt-2 border-t border-border flex flex-col items-center gap-3">
            <BrandWordmark height={22} />
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted font-semibold">
              <a
                href={utils.resolvePath('privacy')}
                className="hover:text-primary transition-colors"
              >
                Privacy Policy
              </a>
              <a href={utils.resolvePath('terms')} className="hover:text-primary transition-colors">
                Terms of Service
              </a>
              <a
                href={utils.resolvePath('refunds')}
                className="hover:text-primary transition-colors"
              >
                Refund Policy
              </a>
              <a
                href={utils.resolvePath('delete-account')}
                className="hover:text-danger transition-colors"
              >
                Delete Account
              </a>
            </div>
          </div>
        </div>
      </BottomSheet>

      {/* DYNAMIC VIEW BODY */}
      <main className="flex-1 flex flex-col relative w-full">
        <Suspense fallback={<BrandLoader fullScreen label="Loading Workspace..." />}>
          <AnimatePresence mode="wait" initial={false}>
            {currentView === 'auth' && (
              <motion.div
                key="auth"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16 }}
                className="flex-1 flex flex-col"
              >
                <Auth onContinueAsGuest={() => navigateTo('home')} />
              </motion.div>
            )}

            {currentView === 'home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="flex-1 flex flex-col"
              >
                <Home
                  onOpenLobby={handleOpenLobby}
                  onJoinSession={handleJoinSession}
                  onLaunchSquadSession={handleLaunchSquadSession}
                  onViewLedger={() => navigateTo('ledger')}
                  onOpenProPlans={() => setShowProSheet(true)}
                  onRequireSignIn={handleSignOut}
                  user={user}
                />
              </motion.div>
            )}

            {currentView === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="flex-1 flex flex-col"
              >
                <Profile
                  user={user}
                  onBack={() => navigateTo('home')}
                  isOnboarding={isOnboarding}
                  onComplete={() => {
                    setIsOnboarding(false);
                    navigateTo('home');
                  }}
                />
              </motion.div>
            )}

            {currentView === 'friends' && (
              <motion.div
                key="friends"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="flex-1 flex flex-col"
              >
                <Friends user={user} onBack={() => navigateTo('home')} />
              </motion.div>
            )}

            {currentView === 'ledger' && (
              <motion.div
                key="ledger"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="flex-1 flex flex-col"
              >
                <Ledger user={user} onBack={() => navigateTo('home')} />
              </motion.div>
            )}

            {currentView === 'analytics' && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="flex-1 flex flex-col"
              >
                <Analytics user={user} onBack={() => navigateTo('home')} />
              </motion.div>
            )}

            {currentView === 'lobby' && (
              <motion.div
                key="lobby"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.16 }}
                className="flex-1 flex flex-col"
              >
                <Lobby
                  initialMode={lobbyMode}
                  onClose={() => navigateTo('home')}
                  onJoin={handleJoinSession}
                />
              </motion.div>
            )}

            {currentView === 'session' && (
              <motion.div
                key="session"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.16 }}
                className="flex-1 flex flex-col"
              >
                <ActiveSession
                  sessionId={activeSessionId}
                  pin={activeSessionPin}
                  initialName={activeSessionName}
                  isHost={isHost}
                  onExit={handleLeaveSession}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </Suspense>
      </main>

      {showBottomDock && (
        <BottomDock
          activeTab={currentView as DockTab}
          onSelectTab={handleSelectDockTab}
          onNewSession={() => handleInstantCreateSession()}
        />
      )}
    </div>
  );
}
