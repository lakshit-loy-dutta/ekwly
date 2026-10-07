import { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import Home from './Home';
import ActiveSession from './ActiveSession';
import Auth from './Auth';
import Lobby from './Lobby';
import Profile from './Profile';
import Friends from './Friends';
import Ledger from './Ledger';
import PwaUpdater from './PwaUpdater';
import BottomSheet from './ui/BottomSheet';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  User,
  Users,
  LogOut,
  Moon,
  QrCode,
  Home as HomeIcon,
  Edit2,
  Wallet,
  Shield,
  FileText,
  RefreshCcw,
  ExternalLink,
} from 'lucide-react';

export default function AppRouter() {
  const [currentView, setCurrentView] = useState<
    'auth' | 'home' | 'lobby' | 'session' | 'profile' | 'friends' | 'ledger' | 'onboarding'
  >('auth');
  const [lobbyMode, setLobbyMode] = useState<'create' | 'join'>('create');
  const [activeSessionName, setActiveSessionName] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSessionPin, setActiveSessionPin] = useState<string | null>(null);
  const [isHost, setIsHost] = useState<boolean>(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [direction, setDirection] = useState<number>(1);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // 1. Add this ref to track if we've already routed
  const hasRoutedRef = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      // 2. Only route if we haven't already
      if (session?.user && !hasRoutedRef.current) {
        hasRoutedRef.current = true;
        resolveInitialRoute();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      // 3. Ignore background refreshes if already routed
      if (event === 'SIGNED_IN' && !hasRoutedRef.current) {
        hasRoutedRef.current = true;
        resolveInitialRoute(session?.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const resolveInitialRoute = async (currentUser?: SupabaseUser) => {
    if (typeof window === 'undefined') return;

    // --- NEW: ONBOARDING INTERCEPTOR ---
    const activeUser = currentUser || user;
    if (activeUser && !activeUser.is_anonymous) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', activeUser.id)
        .maybeSingle(); // Changed from .single() to .maybeSingle()

      if (!profile?.name) {
        setCurrentView('onboarding');
        return; // Halt routing until setup is complete
      }
    }

    const params = new URLSearchParams(window.location.search);
    const sId = params.get('s');
    const pPin = params.get('p');
    const addFriendId = params.get('add_friend');

    // Handle Friend Invites
    if (addFriendId) {
      if (activeUser && !activeUser.is_anonymous) {
        if (activeUser.id === addFriendId)
          showToast("You can't add yourself as a friend.", 'default');
        else {
          await supabase
            .from('connections')
            .insert({ user_id: activeUser.id, friend_id: addFriendId });
          showToast('Friend added successfully!', 'success');
        }
      } else {
        showToast('Sign in to add this friend.', 'error');
      }
      window.history.pushState({}, '', window.location.pathname);
      setCurrentView('friends');
      return;
    }

    // Handle Session Invites
    if (sId) {
      const hostCheck = localStorage.getItem(`ekwly_host_${sId}`);
      const host = hostCheck === 'true';
      const savedPin = pPin || localStorage.getItem(`ekwly_pin_${sId}`);

      if (host) {
        setActiveSessionId(sId);
        setActiveSessionPin(savedPin || '');
        setIsHost(true);
        setCurrentStep(1);
        setCurrentView('session');
      } else if (savedPin) {
        const { data: isValid } = await supabase.rpc('verify_session_pin', {
          p_session_id: sId,
          p_pin: savedPin,
        });
        if (isValid) {
          localStorage.setItem(`ekwly_pin_${sId}`, savedPin);
          setActiveSessionId(sId);
          setActiveSessionPin(savedPin);
          setIsHost(false);
          setCurrentStep(3);
          setCurrentView('session');
        } else {
          showToast('Invalid or expired PIN.', 'error');
          window.history.pushState({}, '', window.location.pathname);
          setCurrentView('home');
        }
      } else {
        window.history.pushState({}, '', window.location.pathname);
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
    window.history.pushState({}, '', `?s=${newSessionId}&p=${pin}`);
    setActiveSessionId(newSessionId);
    setActiveSessionPin(pin);
    setActiveSessionName(name); // Save name for ActiveSession!
    setIsHost(true);
    setCurrentStep(1);
    setCurrentView('session');
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

    showToast(`Joining session...`, 'success');
    localStorage.setItem(`ekwly_pin_${sessionId}`, pin);
    window.history.pushState({}, '', `?s=${sessionId}&p=${pin}`);
    setActiveSessionId(sessionId);
    setActiveSessionPin(pin);
    setIsHost(host);
    setCurrentStep(host ? 1 : 3);
    setCurrentView('session');
  };

  const navigateStep = (newStep: number) => {
    setDirection(newStep > currentStep ? 1 : -1);
    setCurrentStep(newStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLeaveSession = () => {
    window.history.pushState({}, '', window.location.pathname);
    setActiveSessionId(null);
    setActiveSessionPin(null);
    setIsHost(false);
    setCurrentView('home');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    hasRoutedRef.current = false;
    setIsProfileOpen(false);
    setCurrentView('auth');
    window.history.pushState({}, '', window.location.pathname);
  };

  const toggleNativeTheme = () => {
    if (typeof window !== 'undefined' && (window as any).toggleTheme) {
      (window as any).toggleTheme();
    }
  };

  return (
    <div className="min-h-screen bg-subtle md:bg-page flex flex-col items-center relative">
      <PwaUpdater />
      {currentView !== 'auth' && currentView !== 'lobby' && (
        <div className="w-full max-w-2xl bg-surface border-b border-border h-16 flex items-center justify-between px-4 md:px-6 sticky top-0 z-50 shadow-sm">
          {['session', 'profile', 'friends', 'ledger'].includes(currentView) ? (
            <div className="flex items-center gap-1 sm:gap-2 overflow-hidden flex-1">
              <button
                onClick={() => {
                  if (['profile', 'friends', 'ledger'].includes(currentView)) {
                    setCurrentView('home');
                  } else if (currentStep > 1 && (isHost || currentStep > 3)) {
                    navigateStep(currentStep - 1);
                  } else {
                    handleLeaveSession();
                  }
                }}
                className="p-2 -ml-2 hover:bg-subtle rounded-full transition-colors shrink-0 text-primary"
              >
                <ChevronLeft size={24} />
              </button>
              <h1 className="text-[1.05rem] sm:text-[1.1rem] font-semibold text-main tracking-tight truncate">
                {currentView === 'profile' && 'Your Profile'}
                {currentView === 'friends' && 'Friends List'}
                {currentView === 'ledger' && 'Global Ledger'}
                {currentView === 'session' && currentStep === 1 && 'Taxes & Extra Charges'}
                {currentView === 'session' && currentStep === 2 && 'Receipt Items'}
                {currentView === 'session' && currentStep === 3 && 'Members'}
                {currentView === 'session' && currentStep === 4 && 'Claims'}
                {currentView === 'session' && currentStep === 5 && 'Payments'}
                {currentView === 'session' && currentStep === 6 && 'Bill Summary'}
              </h1>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <img
                src="/ekwly/icon.svg"
                width="32"
                height="32"
                alt="Ekwly Logo"
                className="rounded-lg shadow-sm"
              />
              <h1 className="font-bold text-xl text-main tracking-tight">Ekwly</h1>
            </div>
          )}

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {currentView === 'session' && (
              <>
                <button
                  onClick={() => setIsShareModalOpen(true)}
                  className="p-2 rounded-full text-primary hover:bg-subtle transition-colors"
                >
                  <QrCode size={20} />
                </button>
                <button
                  onClick={handleLeaveSession}
                  className="p-2 rounded-full text-danger hover:bg-danger/10 transition-colors"
                >
                  <HomeIcon size={20} />
                </button>
              </>
            )}
            <button
              onClick={toggleNativeTheme}
              className="p-2 hover:bg-subtle rounded-full text-muted transition-colors"
            >
              <Moon size={20} />
            </button>

            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
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

              {/* THE NEW NATIVE MAIN MENU & LEGAL HUB */}
              <BottomSheet
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                title="Menu"
              >
                <div className="flex flex-col gap-6 pb-4">
                  {/* 1. Profile Header Card */}
                  <div className="flex items-center gap-4 bg-surface border border-border p-4 rounded-3xl shadow-sm">
                    <div className="w-14 h-14 rounded-full bg-primary-light border-2 border-primary/20 text-primary flex items-center justify-center font-bold text-xl overflow-hidden shrink-0">
                      {user?.user_metadata?.avatar_url ? (
                        <img
                          src={user.user_metadata.avatar_url}
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

                  {/* 2. Primary Navigation Rows */}
                  <div className="flex flex-col bg-surface border border-border rounded-2xl overflow-hidden shadow-sm divide-y divide-border">
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        setCurrentView('ledger');
                      }}
                      className="flex items-center justify-between p-4 hover:bg-subtle active:bg-border transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Wallet size={20} className="text-muted" />{' '}
                        <span className="font-semibold text-main">Global Ledger</span>
                      </div>
                      <ChevronRight size={18} className="text-muted/50" />
                    </button>
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        setCurrentView('friends');
                      }}
                      className="flex items-center justify-between p-4 hover:bg-subtle active:bg-border transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Users size={20} className="text-muted" />{' '}
                        <span className="font-semibold text-main">Friends Network</span>
                      </div>
                      <ChevronRight size={18} className="text-muted/50" />
                    </button>
                  </div>

                  {/* 3. The Legal Hub */}
                  <div className="flex flex-col bg-surface border border-border rounded-2xl overflow-hidden shadow-sm divide-y divide-border">
                    <a
                      href="/ekwly/privacy"
                      className="flex items-center justify-between p-4 hover:bg-subtle active:bg-border transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Shield size={20} className="text-muted" />{' '}
                        <span className="font-semibold text-main">Privacy Policy</span>
                      </div>
                      <ExternalLink size={16} className="text-muted/50" />
                    </a>
                    <a
                      href="/ekwly/terms"
                      className="flex items-center justify-between p-4 hover:bg-subtle active:bg-border transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileText size={20} className="text-muted" />{' '}
                        <span className="font-semibold text-main">Terms of Service</span>
                      </div>
                      <ExternalLink size={16} className="text-muted/50" />
                    </a>
                    <a
                      href="/ekwly/refunds"
                      className="flex items-center justify-between p-4 hover:bg-subtle active:bg-border transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <RefreshCcw size={20} className="text-muted" />{' '}
                        <span className="font-semibold text-main">Refund Policy</span>
                      </div>
                      <ExternalLink size={16} className="text-muted/50" />
                    </a>
                  </div>

                  {/* 4. Danger Zone */}
                  <button
                    onClick={handleSignOut}
                    className="h-14 w-full mt-2 bg-danger/10 text-danger border border-danger/20 rounded-2xl font-bold text-[0.95rem] flex items-center justify-center gap-2 active:bg-danger/20 transition-colors shadow-sm"
                  >
                    <LogOut size={18} /> Sign Out
                  </button>
                </div>
              </BottomSheet>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-2xl mx-auto bg-page relative md:shadow-stripe md:border-x md:border-border min-h-screen md:min-h-[calc(100vh-64px)] flex flex-col overflow-hidden no-scrollbar">
        {currentView === 'auth' && <Auth onContinueAsGuest={resolveInitialRoute} />}
        {currentView === 'home' && (
          <Home
            onOpenLobby={(mode) => {
              setLobbyMode(mode);
              setCurrentView('lobby');
            }}
            onJoinSession={handleJoinSession}
            onViewLedger={() => setCurrentView('ledger')}
            user={user}
          />
        )}
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
        {currentView === 'profile' && <Profile user={user} onBack={() => setCurrentView('home')} />}
        {currentView === 'friends' && <Friends user={user} onBack={() => setCurrentView('home')} />}
        {currentView === 'ledger' && <Ledger user={user} onBack={() => setCurrentView('home')} />}
        {currentView === 'session' && (
          <ActiveSession
            sessionId={activeSessionId}
            pin={activeSessionPin}
            initialName={activeSessionName}
            isHost={isHost}
            currentStep={currentStep}
            direction={direction}
            navigate={navigateStep}
            onExit={handleLeaveSession}
          />
        )}
      </div>

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
            <p className="text-3xl font-mono font-bold text-primary tracking-[0.2em]">
              {activeSessionPin}
            </p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-border mb-4">
            <QRCode
              value={`${typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''}?s=${activeSessionId}&p=${activeSessionPin}`}
              size={200}
            />
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
