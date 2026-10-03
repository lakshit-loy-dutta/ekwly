import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import Home from './Home';
import ActiveSession from './ActiveSession';
import Auth from './Auth';
import Profile from './Profile';
import BottomSheet from './ui/BottomSheet';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/utils';
import { ChevronLeft, User, LogOut, Moon, QrCode, Home as HomeIcon } from 'lucide-react';

export default function AppRouter() {
  const [currentView, setCurrentView] = useState<'auth' | 'home' | 'session' | 'profile'>('auth');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSessionPin, setActiveSessionPin] = useState<string | null>(null);
  const [isHost, setIsHost] = useState<boolean>(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [direction, setDirection] = useState<number>(1);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) resolveInitialRoute();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      // Only resolve the route when explicitly signing in
      if (event === 'SIGNED_IN') resolveInitialRoute();
    });

    return () => subscription.unsubscribe();
  }, []);

  const resolveInitialRoute = async () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sId = params.get('s');
      const pPin = params.get('p');

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
    }
  };

  const handleStartNew = () => {
    const newSessionId = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();

    localStorage.setItem(`ekwly_host_${newSessionId}`, 'true');
    localStorage.setItem(`ekwly_pin_${newSessionId}`, newPin);

    window.history.pushState({}, '', `?s=${newSessionId}&p=${newPin}`);
    setActiveSessionId(newSessionId);
    setActiveSessionPin(newPin);
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
      {currentView !== 'auth' && (
        <div className="w-full max-w-2xl bg-surface border-b border-border h-16 flex items-center justify-between px-4 md:px-6 sticky top-0 z-50 shadow-sm">
          {currentView === 'session' || currentView === 'profile' ? (
            <div className="flex items-center gap-1 sm:gap-2 overflow-hidden flex-1">
              <button
                onClick={() => {
                  if (currentView === 'profile') {
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

              {isProfileOpen && (
                <div className="absolute right-0 top-12 w-56 bg-surface border border-border rounded-xl shadow-md py-2 flex flex-col">
                  <div className="px-4 py-2 border-b border-border mb-2">
                    <p className="font-bold text-main text-sm truncate">
                      {user?.user_metadata?.full_name || 'Guest User'}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {user?.email || 'Anonymous Session'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      setCurrentView('profile');
                    }}
                    className="px-4 py-2 text-left text-sm font-semibold text-main hover:bg-subtle flex items-center gap-2 mx-2 rounded-md transition-colors"
                  >
                    <User size={16} className="text-muted" /> Edit Profile
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="px-4 py-2 text-left text-sm font-semibold text-danger hover:bg-danger/10 flex items-center gap-2 mx-2 rounded-md transition-colors mt-1"
                  >
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-2xl mx-auto bg-page relative md:shadow-stripe md:border-x md:border-border min-h-screen md:min-h-[calc(100vh-64px)] flex flex-col overflow-hidden no-scrollbar">
        {currentView === 'auth' && <Auth onContinueAsGuest={resolveInitialRoute} />}
        {currentView === 'home' && (
          <Home onStartNew={handleStartNew} onJoinSession={handleJoinSession} user={user} />
        )}
        {currentView === 'profile' && <Profile user={user} onBack={() => setCurrentView('home')} />}
        {currentView === 'session' && (
          <ActiveSession
            sessionId={activeSessionId}
            pin={activeSessionPin}
            isHost={isHost}
            currentStep={currentStep}
            direction={direction}
            navigate={navigateStep}
            onExit={handleLeaveSession}
          />
        )}
      </div>

      {isProfileOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)}></div>
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
