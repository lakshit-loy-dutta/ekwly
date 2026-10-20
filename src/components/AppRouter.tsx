// src/components/AppRouter.tsx
import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import QRCode from 'react-qr-code';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import Home from './Home';
import Auth from './Auth';
import PwaUpdater from './PwaUpdater';
import BottomSheet from './ui/BottomSheet';
import BottomDock, { type DockTab } from './ui/BottomDock';
import BrandLoader, { BrandLogo } from './ui/BrandLoader';
import { swrCache } from '../lib/swrCache';
import { supabase } from '../lib/supabase';
import { showToast, utils } from '../lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  User,
  Users,
  LogOut,
  BarChart3,
  Moon,
  Sun,
  QrCode,
  Edit2,
  Wallet,
  Shield,
  FileText,
  RefreshCcw,
  ExternalLink,
} from 'lucide-react';

const ActiveSession = lazy(() => import('./ActiveSession'));
const Lobby = lazy(() => import('./Lobby'));
const Profile = lazy(() => import('./Profile'));
const Friends = lazy(() => import('./Friends'));
const Ledger = lazy(() => import('./Ledger'));
const Analytics = lazy(() => import('./Analytics'));

type AppView =
  | 'auth'
  | 'home'
  | 'lobby'
  | 'session'
  | 'profile'
  | 'friends'
  | 'ledger'
  | 'analytics'
  | 'onboarding';

const DOCK_VIEWS: AppView[] = ['home', 'ledger', 'friends', 'analytics', 'profile'];

export default function AppRouter() {
  const [currentView, setCurrentView] = useState<AppView>('auth');
  const [lobbyMode, setLobbyMode] = useState<'create' | 'join'>('join');
  const [activeSessionName, setActiveSessionName] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSessionPin, setActiveSessionPin] = useState<string | null>(null);
  const [isHost, setIsHost] = useState<boolean>(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const hasRoutedRef = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user && !hasRoutedRef.current) {
        hasRoutedRef.current = true;
        resolveInitialRoute(session.user);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'SIGNED_IN' && !hasRoutedRef.current) {
        hasRoutedRef.current = true;
        resolveInitialRoute(session?.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== 'undefined'
      ? document.documentElement.getAttribute('data-theme') !== 'light'
      : true
  );

  useEffect(() => {
    const handleBackAction = () => {
      if (isShareModalOpen) {
        setIsShareModalOpen(false);
        return true;
      }
      if (isProfileOpen) {
        setIsProfileOpen(false);
        return true;
      }
      if (['profile', 'friends', 'ledger', 'lobby', 'analytics'].includes(currentView)) {
        setCurrentView('home');
        return true;
      }
      if (currentView === 'session') {
        handleLeaveSession();
        return true;
      }
      return false;
    };

    const onPopState = () => {
      handleBackAction();
    };
    window.addEventListener('popstate', onPopState);

    let capCleanup: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      const listener = CapApp.addListener('backButton', ({ canGoBack }) => {
        const handled = handleBackAction();
        if (!handled && !canGoBack) {
          CapApp.exitApp();
        }
      });
      capCleanup = () => {
        listener.then((l) => l.remove());
      };
    }

    return () => {
      window.removeEventListener('popstate', onPopState);
      capCleanup?.();
    };
  }, [currentView, isShareModalOpen, isProfileOpen]);

  const toggleNativeTheme = () => {
    if (typeof window !== 'undefined' && window.toggleTheme) {
      utils.haptic('light');
      window.toggleTheme();
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    }
  };

  const resolveInitialRoute = async (currentUser?: SupabaseUser) => {
    if (typeof window === 'undefined') return;

    const activeUser = currentUser || user;
    if (activeUser && !activeUser.is_anonymous) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', activeUser.id)
        .maybeSingle();

      if (!profile?.name || /^Guest\s+[0-9a-f]{5}$/i.test(profile.name)) {
        setCurrentView('onboarding');
        return;
      }
    }

    const params = new URLSearchParams(window.location.search);
    const sId = params.get('s');
    const pPin = params.get('p');
    const addFriendId = params.get('add_friend');

    if (addFriendId) {
      if (activeUser && !activeUser.is_anonymous) {
        if (activeUser.id === addFriendId) {
          showToast("You can't add yourself as a friend.", 'default');
        } else {
          await supabase
            .from('connections')
            .insert({ user_id: activeUser.id, friend_id: addFriendId });
          showToast('Friend added successfully!', 'success');
        }
      } else {
        showToast('Sign in to add this friend.', 'error');
      }
      window.history.replaceState({}, '', window.location.pathname);
      setCurrentView('friends');
      return;
    }

    if (sId) {
      const hostCheck = localStorage.getItem(`ekwly_host_${sId}`);
      const host = hostCheck === 'true';
      const savedPin = pPin || localStorage.getItem(`ekwly_pin_${sId}`);

      if (host) {
        window.history.replaceState({}, '', `?s=${sId}`);
        setActiveSessionId(sId);
        setActiveSessionPin(savedPin || '');
        setIsHost(true);
        setCurrentView('session');
      } else if (savedPin) {
        const { data: isValid } = await supabase.rpc('verify_session_pin', {
          p_session_id: sId,
          p_pin: savedPin,
        });
        if (isValid) {
          localStorage.setItem(`ekwly_pin_${sId}`, savedPin);
          window.history.replaceState({}, '', `?s=${sId}`);
          setActiveSessionId(sId);
          setActiveSessionPin(savedPin);
          setIsHost(false);
          setCurrentView('session');
        } else {
          showToast('Invalid or expired PIN.', 'error');
          window.history.replaceState({}, '', window.location.pathname);
          setCurrentView('home');
        }
      } else {
        window.history.replaceState({}, '', window.location.pathname);
        setCurrentView('home');
      }
    } else {
      setCurrentView('home');
    }
  };

  const handleLaunchRoom = (name: string, pin: string) => {
    const newSessionId = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    localStorage.setItem(`ekwly_host_${newSessionId}`, 'true');
    localStorage.setItem(`ekwly_pin_${newSessionId}`, pin);
    window.history.pushState({ view: 'session' }, '', `?s=${newSessionId}`);
    setActiveSessionId(newSessionId);
    setActiveSessionPin(pin);
    setActiveSessionName(name || null);
    setIsHost(true);
    setCurrentView('session');
  };

  const handleQuickLaunchRoom = () => {
    const autoPin = Math.floor(1000 + Math.random() * 9000).toString();
    handleLaunchRoom('', autoPin);
  };

  const handleJoinSession = async (sessionId: string, pin: string) => {
    const hostCheck = localStorage.getItem(`ekwly_host_${sessionId}`);
    const host = hostCheck === 'true';

    if (!host) {
      const { data: isValid, error } = await supabase.rpc('verify_session_pin', {
        p_session_id: sessionId,
        p_pin: pin,
      });
      if (!isValid || error) {
        showToast('Invalid Session ID or PIN', 'error');
        return;
      }
    }

    showToast('Joining session...', 'success');
    localStorage.setItem(`ekwly_pin_${sessionId}`, pin);
    window.history.pushState({ view: 'session' }, '', `?s=${sessionId}`);
    setActiveSessionId(sessionId);
    setActiveSessionPin(pin);
    setActiveSessionName(null);
    setIsHost(host);
    setCurrentView('session');
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

  const handleSelectDockTab = (tab: DockTab) => {
    window.history.pushState({ view: tab }, '', window.location.pathname);
    setCurrentView(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenInviteQr = () => {
    utils.haptic('light');
    if (activeSessionId && typeof window !== 'undefined') {
      localStorage.setItem(`ekwly_multiplayer_${activeSessionId}`, 'true');
      window.dispatchEvent(
        new CustomEvent('ekwly:enable-realtime', { detail: { sessionId: activeSessionId } })
      );
    }
    setIsShareModalOpen(true);
  };

  const handleSignOut = async () => {
    swrCache.clearAll();
    await supabase.auth.signOut();
    hasRoutedRef.current = false;
    setIsProfileOpen(false);
    setCurrentView('auth');
    window.history.replaceState({}, '', window.location.pathname);
  };

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?s=${activeSessionId}&p=${activeSessionPin}`
      : '';

  return (
    <div className="min-h-screen bg-subtle md:bg-page flex flex-col items-center relative">
      <PwaUpdater />
      {currentView !== 'auth' && currentView !== 'lobby' && (
        <div className="w-full max-w-2xl bg-surface/85 backdrop-blur-xl border-b border-border h-16 flex items-center justify-between px-4 md:px-6 sticky top-0 z-40 shadow-sm gpu-layer">
          {['session', 'profile', 'friends', 'ledger', 'analytics'].includes(currentView) ? (
            <div className="flex items-center gap-1 sm:gap-2 overflow-hidden flex-1">
              <button
                onClick={() => {
                  utils.haptic('light');
                  if (['profile', 'friends', 'ledger', 'analytics'].includes(currentView)) {
                    setCurrentView('home');
                  } else {
                    handleLeaveSession();
                  }
                }}
                className="p-2 -ml-2 hover:bg-subtle rounded-full transition-colors shrink-0 text-primary"
                aria-label="Go back"
              >
                <ChevronLeft size={24} />
              </button>
              <h1 className="text-[1.05rem] sm:text-[1.1rem] font-bold text-main tracking-tight truncate">
                {currentView === 'profile' && 'Your Profile'}
                {currentView === 'friends' && 'Dining Network'}
                {currentView === 'ledger' && 'Global Ledger'}
                {currentView === 'analytics' && 'Personal Analytics'}
                {currentView === 'session' && (activeSessionName || 'Split Workbench')}
              </h1>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <BrandLogo className="shadow-sm" size={32} />
              <h1 className="font-extrabold text-xl text-main tracking-tight">Ekwly</h1>
            </div>
          )}

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {currentView === 'session' && (
              <button
                onClick={handleOpenInviteQr}
                className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1.5 text-xs font-bold"
                aria-label="Share Room QR"
              >
                <QrCode size={16} />
                <span>Invite QR</span>
              </button>
            )}
            <button
              onClick={toggleNativeTheme}
              className="p-2 hover:bg-subtle rounded-full text-muted transition-colors"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="relative">
              <button
                onClick={() => {
                  utils.haptic('light');
                  setIsProfileOpen(!isProfileOpen);
                }}
                className="w-9 h-9 rounded-full bg-primary-light border-2 border-primary text-primary flex items-center justify-center font-bold overflow-hidden ml-1"
              >
                {user?.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User size={18} />
                )}
              </button>

              <BottomSheet
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                title="Account & Settings"
              >
                <div className="flex flex-col gap-6 pb-4">
                  <div className="flex items-center gap-4 bg-surface border border-border p-4 rounded-3xl shadow-sm">
                    <div className="w-14 h-14 rounded-full bg-primary-light border-2 border-primary/20 text-primary flex items-center justify-center font-bold text-xl overflow-hidden shrink-0">
                      {user?.user_metadata?.avatar_url ? (
                        <img
                          src={user.user_metadata.avatar_url}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User size={24} />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-bold text-main text-lg tracking-tight truncate">
                        {user?.user_metadata?.full_name || 'Guest User'}
                      </span>
                      <span className="text-xs text-muted font-medium truncate">
                        {user?.email || 'Anonymous Session'}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        setCurrentView('profile');
                      }}
                      className="p-3 text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors shrink-0"
                    >
                      <Edit2 size={18} />
                    </button>
                  </div>

                  <div className="flex flex-col bg-surface border border-border rounded-2xl overflow-hidden shadow-sm divide-y divide-border">
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        setCurrentView('ledger');
                      }}
                      className="flex items-center justify-between p-4 hover:bg-subtle active:bg-border transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Wallet className="text-muted" size={20} />
                        <span className="font-semibold text-main">Global Ledger</span>
                      </div>
                      <ChevronRight className="text-muted/50" size={18} />
                    </button>
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        setCurrentView('analytics');
                      }}
                      className="flex items-center justify-between p-4 hover:bg-subtle active:bg-border transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <BarChart3 className="text-muted" size={20} />
                        <span className="font-semibold text-main">Personal Analytics</span>
                      </div>
                      <ChevronRight className="text-muted/50" size={18} />
                    </button>
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        setCurrentView('friends');
                      }}
                      className="flex items-center justify-between p-4 hover:bg-subtle active:bg-border transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Users className="text-muted" size={20} />
                        <span className="font-semibold text-main">Dining Network</span>
                      </div>
                      <ChevronRight className="text-muted/50" size={18} />
                    </button>
                  </div>

                  <div className="flex flex-col bg-surface border border-border rounded-2xl overflow-hidden shadow-sm divide-y divide-border">
                    <a
                      href={utils.resolvePath('privacy')}
                      className="flex items-center justify-between p-4 hover:bg-subtle active:bg-border transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Shield className="text-muted" size={20} />
                        <span className="font-semibold text-main">Privacy Policy</span>
                      </div>
                      <ExternalLink className="text-muted/50" size={16} />
                    </a>
                    <a
                      href={utils.resolvePath('terms')}
                      className="flex items-center justify-between p-4 hover:bg-subtle active:bg-border transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="text-muted" size={20} />
                        <span className="font-semibold text-main">Terms of Service</span>
                      </div>
                      <ExternalLink className="text-muted/50" size={16} />
                    </a>
                    <a
                      href={utils.resolvePath('refunds')}
                      className="flex items-center justify-between p-4 hover:bg-subtle active:bg-border transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <RefreshCcw className="text-muted" size={20} />
                        <span className="font-semibold text-main">Refund Policy</span>
                      </div>
                      <ExternalLink className="text-muted/50" size={16} />
                    </a>
                  </div>

                  <button
                    onClick={handleSignOut}
                    className="h-14 w-full mt-2 bg-danger/10 text-danger border border-danger/20 rounded-2xl font-bold text-[0.95rem] flex items-center justify-center gap-2 active:bg-danger/20 transition-colors shadow-sm"
                  >
                    <LogOut size={18} />{' '}
                    {user?.is_anonymous ? 'Link Account / Sign In' : 'Sign Out'}
                  </button>
                </div>
              </BottomSheet>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-2xl mx-auto bg-page relative md:shadow-stripe md:border-x md:border-border min-h-screen md:min-h-[calc(100vh-64px)] flex flex-col overflow-x-clip no-scrollbar">
        {currentView === 'auth' && <Auth onContinueAsGuest={resolveInitialRoute} />}
        {currentView === 'home' && (
          <Home
            onOpenLobby={(mode) => {
              if (mode === 'create') {
                handleQuickLaunchRoom();
              } else {
                setLobbyMode('join');
                setCurrentView('lobby');
              }
            }}
            onJoinSession={handleJoinSession}
            onViewLedger={() => handleSelectDockTab('ledger')}
            onRequireSignIn={handleSignOut}
            user={user}
          />
        )}

        <Suspense fallback={<BrandLoader fullScreen label="Loading..." />}>
          {currentView === 'lobby' && (
            <Lobby
              initialMode={lobbyMode}
              onClose={() => setCurrentView('home')}
              onLaunch={handleLaunchRoom}
              onJoin={handleJoinSession}
            />
          )}
          {currentView === 'onboarding' && (
            <Profile
              user={user}
              onBack={() => {}}
              isOnboarding={true}
              onComplete={() => resolveInitialRoute()}
            />
          )}
          {currentView === 'profile' && (
            <Profile user={user} onBack={() => setCurrentView('home')} />
          )}
          {currentView === 'friends' && (
            <Friends user={user} onBack={() => setCurrentView('home')} />
          )}
          {currentView === 'ledger' && <Ledger user={user} onBack={() => setCurrentView('home')} />}
          {currentView === 'analytics' && (
            <Analytics user={user} onBack={() => setCurrentView('home')} />
          )}
          {currentView === 'session' && (
            <ActiveSession
              sessionId={activeSessionId}
              pin={activeSessionPin}
              initialName={activeSessionName}
              isHost={isHost}
              onExit={handleLeaveSession}
            />
          )}
        </Suspense>
      </div>

      {DOCK_VIEWS.includes(currentView) && (
        <BottomDock
          activeTab={currentView as DockTab}
          onSelectTab={handleSelectDockTab}
          onNewSession={handleQuickLaunchRoom}
        />
      )}

      <BottomSheet
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title="Invite to Session"
      >
        <div className="flex flex-col items-center">
          <p className="text-sm text-muted text-center mb-4">
            Scan this code to join session <strong className="text-main">{activeSessionId}</strong>.
          </p>
          <div className="bg-subtle border border-border rounded-xl px-6 py-3 mb-6">
            <p className="text-xs font-bold uppercase tracking-widest text-muted mb-1 text-center">
              Room PIN
            </p>
            <p className="text-3xl font-mono font-bold text-primary tracking-[0.2em] tabular-nums">
              {activeSessionPin}
            </p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-border mb-4">
            <QRCode value={shareUrl} size={200} />
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
