import { useState, useEffect } from 'react';
import Home from './Home';
import ActiveSession from './ActiveSession';
import Auth from './Auth';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/utils';
import { ChevronLeft, User, LogOut, Moon } from 'lucide-react';

export default function AppRouter() {
  const [currentView, setCurrentView] = useState<'auth' | 'home' | 'session'>('auth');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState<boolean>(false);
  const [user, setUser] = useState<any>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) resolveInitialRoute();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user && currentView === 'auth') resolveInitialRoute();
    });

    return () => subscription.unsubscribe();
  }, [currentView]);

  const resolveInitialRoute = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sId = params.get('s');
      if (sId) {
        setActiveSessionId(sId);
        const hostCheck = localStorage.getItem(`ekwly_host_${sId}`);
        setIsHost(hostCheck === 'true');
        setCurrentView('session');
      } else {
        setCurrentView('home');
      }
    }
  };

  const handleStartNew = () => {
    const newSessionId = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    localStorage.setItem(`ekwly_host_${newSessionId}`, 'true');
    window.history.pushState({}, '', `?s=${newSessionId}`);
    setActiveSessionId(newSessionId);
    setIsHost(true);
    setCurrentView('session');
  };

  const handleJoinSession = (sessionId: string) => {
    showToast(`Joining session: ${sessionId}`, 'success');
    const hostCheck = localStorage.getItem(`ekwly_host_${sessionId}`);
    setIsHost(hostCheck === 'true');
    window.history.pushState({}, '', `?s=${sessionId}`);
    setActiveSessionId(sessionId);
    setCurrentView('session');
  };

  const handleLeaveSession = () => {
    window.history.pushState({}, '', window.location.pathname);
    setActiveSessionId(null);
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
      {/* UNIVERSAL MOBILE-FIRST HEADER */}
      {currentView !== 'auth' && (
        <div className="w-full max-w-2xl bg-surface border-b border-border h-16 flex items-center justify-between px-4 md:px-6 sticky top-0 z-50 shadow-sm">
          <div className="flex items-center gap-3">
            {currentView === 'session' ? (
              <button
                onClick={handleLeaveSession}
                className="p-2 -ml-2 hover:bg-subtle rounded-full transition-colors flex items-center text-primary font-semibold"
              >
                <ChevronLeft size={24} />
                <span className="hidden sm:inline">Back</span>
              </button>
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
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleNativeTheme}
              className="p-2 hover:bg-subtle rounded-full text-muted transition-colors"
            >
              <Moon size={20} />
            </button>

            {/* AVATAR & PROFILE MENU */}
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="w-9 h-9 rounded-full bg-primary-light border-2 border-primary text-primary flex items-center justify-center font-bold overflow-hidden"
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
                    onClick={handleSignOut}
                    className="px-4 py-2 text-left text-sm font-semibold text-danger hover:bg-danger/10 flex items-center gap-2 mx-2 rounded-md transition-colors"
                  >
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="w-full max-w-2xl mx-auto bg-page relative md:shadow-stripe md:border-x md:border-border min-h-screen md:min-h-[calc(100vh-64px)] flex flex-col overflow-hidden no-scrollbar">
        {currentView === 'auth' && <Auth onContinueAsGuest={resolveInitialRoute} />}
        {currentView === 'home' && (
          <Home onStartNew={handleStartNew} onJoinSession={handleJoinSession} />
        )}
        {currentView === 'session' && <ActiveSession sessionId={activeSessionId} isHost={isHost} />}
      </div>

      {/* Profile Menu Backdrop to close when clicking outside */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)}></div>
      )}
    </div>
  );
}
