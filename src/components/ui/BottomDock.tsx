import { motion } from 'framer-motion';
import { Home, Wallet, Plus, Users, BarChart3 } from 'lucide-react';
import { utils } from '../../lib/utils';

export type DockTab = 'home' | 'ledger' | 'friends' | 'analytics' | 'profile';

interface Props {
  activeTab: DockTab;
  onSelectTab: (tab: DockTab) => void;
  onNewSession: () => void;
}

const LEFT_TABS: { id: DockTab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'ledger', label: 'Ledger', icon: Wallet },
];

const RIGHT_TABS: { id: DockTab; label: string; icon: typeof Home }[] = [
  { id: 'friends', label: 'Friends', icon: Users },
  { id: 'analytics', label: 'Insights', icon: BarChart3 },
];

export default function BottomDock({ activeTab, onSelectTab, onNewSession }: Props) {
  const renderTab = (tab: { id: DockTab; label: string; icon: typeof Home }) => {
    const Icon = tab.icon;
    const isActive = activeTab === tab.id;

    return (
      <button
        key={tab.id}
        type="button"
        onClick={() => {
          if (!isActive) {
            utils.haptic('light');
            onSelectTab(tab.id);
          }
        }}
        className={`relative flex-1 flex flex-col items-center justify-center py-2 rounded-2xl transition-colors ${
          isActive ? 'text-primary' : 'text-muted hover:text-main'
        }`}
      >
        {isActive && (
          <motion.div
            layoutId="ekwly-dock-pill"
            transition={{ type: 'spring', stiffness: 500, damping: 34, mass: 0.8 }}
            className="absolute inset-x-1.5 inset-y-1 glass-pill rounded-xl z-0"
          />
        )}
        <Icon className="relative z-10" size={20} strokeWidth={isActive ? 2.5 : 2} />
        <span className="relative z-10 text-[0.65rem] font-bold tracking-tight mt-0.5">
          {tab.label}
        </span>
      </button>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none flex justify-center px-4 pb-4 pb-safe">
      <nav
        aria-label="Primary Navigation"
        className="pointer-events-auto w-full max-w-md glass-dock rounded-3xl px-2.5 py-2 flex items-center justify-between gap-1 gpu-layer"
      >
        {LEFT_TABS.map(renderTab)}

        {/* Center Primary Action (+ New Room) */}
        <div className="px-1.5">
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              utils.haptic('medium');
              onNewSession();
            }}
            aria-label="Start New Session"
            className="w-12 h-12 rounded-2xl premium-gradient-card text-white flex items-center justify-center shadow-md"
          >
            <Plus size={24} strokeWidth={2.75} />
          </motion.button>
        </div>

        {RIGHT_TABS.map(renderTab)}
      </nav>
    </div>
  );
}
