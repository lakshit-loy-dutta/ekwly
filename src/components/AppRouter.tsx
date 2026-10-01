import { useState, useEffect } from 'react';
import Home from './Home';
import ActiveSession from './ActiveSession';
import { showToast, utils } from '../lib/utils';
import { Moon } from 'lucide-react';

export default function AppRouter() {
  const [currentView, setCurrentView] = useState<'home' | 'session'>('home');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState<boolean>(false);

  // 1. URL ROUTING & FINGERPRINT DETECTION
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sId = params.get('s');
      if (sId) {
        setActiveSessionId(sId);
        // Check if this specific device created the session
        const hostCheck = localStorage.getItem(`ekwly_host_${sId}`);
        setIsHost(hostCheck === 'true');
        setCurrentView('session');
      }
    }
  }, []);

  const handleStartNew = () => {
    const newSessionId = utils.generateId();

    // 2. DROP HOST FINGERPRINT
    localStorage.setItem(`ekwly_host_${newSessionId}`, 'true');

    // 3. SILENTLY UPDATE BROWSER URL
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

  const toggleNativeTheme = () => {
    if (typeof window !== 'undefined' && (window as any).toggleTheme) {
      (window as any).toggleTheme();
    }
  };

  return (
    <div className="min-h-screen bg-subtle md:bg-page flex flex-col items-center relative">
      <div className="hidden md:flex w-full h-16 bg-surface border-b border-border items-center justify-between px-8 z-40 sticky top-0">
        <div className="flex items-center gap-3">
          <img
            src="/icon.svg"
            width="32"
            height="32"
            alt="Ekwly Logo"
            className="rounded-lg shadow-sm"
          />
          <h1 className="font-bold text-xl text-main tracking-tight">Ekwly</h1>
          <span className="ml-4 px-2 py-0.5 bg-subtle border border-border text-muted text-xs font-semibold uppercase tracking-wider rounded-md">
            Settlement Engine
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm font-medium text-muted">
          <span>
            {currentView === 'session' ? `Session ID: ${activeSessionId}` : 'Multiplayer Workspace'}
          </span>
          <button
            onClick={toggleNativeTheme}
            className="p-2 hover:bg-subtle rounded-full text-muted transition-colors cursor-pointer"
          >
            <Moon size={20} />
          </button>
        </div>
      </div>

      <div className="w-full max-w-2xl mx-auto bg-page relative shadow-none md:shadow-stripe md:border-x md:border-border min-h-screen md:min-h-[calc(100vh-64px)] flex flex-col overflow-hidden no-scrollbar">
        {currentView === 'home' && (
          <Home onStartNew={handleStartNew} onJoinSession={handleJoinSession} />
        )}
        {currentView === 'session' && <ActiveSession sessionId={activeSessionId} isHost={isHost} />}
      </div>
    </div>
  );
}
