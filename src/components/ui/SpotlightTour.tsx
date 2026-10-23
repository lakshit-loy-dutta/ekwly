import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Receipt,
  Users,
  Wallet,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  X,
  Layers,
  Zap,
} from 'lucide-react';
import { utils } from '../../lib/utils';
import { BrandLogo, BrandWordmark } from './BrandLoader';

interface TutorialStep {
  kind: 'welcome' | 'free-guide' | 'pro-bonus';
  badge: string;
  title: string;
  description: string;
  howToBullets: string[];
  highlightTip: string;
  icon: typeof Sparkles;
  accentColor: string;
}

const TOUR_SLIDES: TutorialStep[] = [
  {
    kind: 'welcome',
    badge: 'Welcome to Ekwly',
    title: 'Split Bills to the Exact Paisa in 15 Seconds',
    description:
      'Most apps split bills evenly or ignore Indian restaurant taxes—forcing teetotalers to subsidize their friends’ liquor VAT and service charges. Ekwly fixes that forever.',
    howToBullets: [
      '100% Free Forever for unlimited rooms, items, taxes & UPI links',
      'Routes Food GST (5%), Liquor VAT & Service Charge to the exact person',
      'Works Solo (you split the whole bill) or Live Multiplayer via QR',
    ],
    highlightTip: 'Take a 25-second interactive tour to master the Ekwly workflow.',
    icon: Sparkles,
    accentColor: 'text-primary bg-primary/12 border-primary/30',
  },
  {
    kind: 'free-guide',
    badge: 'Step 1 of 4 • Free Tutorial',
    title: 'Start a Room & Check Bottom-of-Bill Taxes',
    description:
      'Tap the center [+] button in the bottom dock (or "New Split") to open a live room immediately—no tedious setup forms required.',
    howToBullets: [
      'Type the restaurant name to auto-load community-verified taxes & menu prices',
      'Or check the bottom of your paper bill and tap the taxes you see (Food GST, Liquor VAT, S.C.)',
      'Not sure how Service Charge is taxed? Type the printed Grand Total and Ekwly auto-detects it!',
    ],
    highlightTip: 'Once your bill rules look right, tap "Hide & Add Items" to collapse the card.',
    icon: Layers,
    accentColor: 'text-primary bg-primary/12 border-primary/30',
  },
  {
    kind: 'free-guide',
    badge: 'Step 2 of 4 • Free Tutorial',
    title: 'Populate Your Table in 1 Tap',
    description:
      'Add everyone dining with you in the "At the Table" bar—either by yourself in Solo Mode or by letting friends scan your Room QR.',
    howToBullets: [
      'Create "Saved Squads" (like "BLR Flatmates" or "Friday Crew") in the Friends tab',
      'Tap a Squad chip on the Home screen or inside a room to add 5+ friends in 1 tap',
      'Friends can also scan your Invite QR to claim their own dishes live',
    ],
    highlightTip:
      'Solo Mode keeps WebSockets off for maximum speed & battery life until you need live sync.',
    icon: Users,
    accentColor: 'text-emerald-500 bg-emerald-500/12 border-emerald-500/30',
  },
  {
    kind: 'free-guide',
    badge: 'Step 3 of 4 • Free Tutorial',
    title: 'Tap Names Right on the Live Receipt',
    description:
      'As you add items, they appear on the skeuomorphic Live Bill Split thermal receipt at the bottom of your screen.',
    howToBullets: [
      'Tap [All] on an item to split a shared starter or pitcher evenly',
      'Tap individual names ([Rahul], [Priya]) to split strictly among those who had it',
      'Tap the sliders icon on any item for uneven fractions like 1/3, 1/2, or 2 shares',
    ],
    highlightTip:
      'Every tap rolls the live rupee counters at 240fps while conserving the exact paisa.',
    icon: Receipt,
    accentColor: 'text-amber-500 bg-amber-500/12 border-amber-500/30',
  },
  {
    kind: 'free-guide',
    badge: 'Step 4 of 4 • Free Tutorial',
    title: 'Settle via UPI QR, Bento Cards & Ledger',
    description:
      'Switch to Tab 2 ("Settle & Collect"), tap who paid the cashier, and lock the room to generate instant settlements.',
    howToBullets: [
      'Tap "Show UPI QR" so friends at the table can scan your phone screen with GPay/PhonePe',
      'Share a dark-mode WhatsApp Bento Receipt Card with your embedded UPI QR into the group chat',
      'Unpaid balances sync to your Global Ledger and automatically net out opposing debts!',
    ],
    highlightTip: 'You can also import your old Splitwise CSV in 1 tap inside the Ledger tab.',
    icon: Wallet,
    accentColor: 'text-primary bg-primary/12 border-primary/30',
  },
  {
    kind: 'pro-bonus',
    badge: 'Bonus • Supercharge with Ekwly Pro',
    title: 'AI Magic Scan, Trip Folders & Tax Audits',
    description:
      'Every account includes 3 Free AI Magic Scans every month! Want unlimited AI scanning on a group vacation plus deep financial analytics?',
    howToBullets: [
      'Unlimited AI Magic Bill Scans: Snap any paper receipt in 5 seconds without typing a word',
      'Multi-Bill Trip Folders: Group 5–10 bills from a Goa/weekend trip & settle all at once',
      'Food vs. Liquor vs. Tax Spend Audit + 1-Tap CSV Expense Exports in Insights',
    ],
    highlightTip: 'Going on a weekend trip? Grab a 7-Day Trip Pass for just ₹49 (or ₹99/mo Pro)!',
    icon: Zap,
    accentColor: 'text-amber-400 bg-amber-500/15 border-amber-500/35',
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenProPlans?: () => void;
}

export default function SpotlightTour({ isOpen, onClose, onOpenProPlans }: Props) {
  const [mounted, setMounted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setStepIndex(0);
    }
  }, [isOpen]);

  if (!mounted || typeof document === 'undefined') return null;

  const currentSlide = TOUR_SLIDES[stepIndex];
  const Icon = currentSlide.icon;
  const isWelcome = currentSlide.kind === 'welcome';
  const isLastSlide = stepIndex === TOUR_SLIDES.length - 1;

  const handleComplete = () => {
    utils.haptic('medium');
    localStorage.setItem('ekwly_tour_completed_v1', 'true');
    onClose();
  };

  const handleNext = () => {
    utils.haptic('light');
    if (isLastSlide) {
      handleComplete();
    } else {
      setStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    utils.haptic('light');
    setStepIndex((prev) => Math.max(0, prev - 1));
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleComplete}
            className="fixed inset-0 bg-black/75 backdrop-blur-md"
          />

          <motion.div
            key={stepIndex}
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="relative z-10 w-full max-w-md glass-card bg-surface border border-border rounded-3xl p-6 shadow-2xl flex flex-col gap-5 max-h-[90dvh] overflow-y-auto"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BrandLogo size={26} boxed />
                <span
                  className={`text-xs font-extrabold uppercase tracking-wider ${
                    currentSlide.kind === 'pro-bonus' ? 'text-amber-400' : 'text-primary'
                  }`}
                >
                  {currentSlide.badge}
                </span>
              </div>
              <button
                type="button"
                onClick={handleComplete}
                className="p-2 rounded-full bg-page border border-border text-muted hover:text-main transition-colors"
                aria-label="Close guide"
              >
                <X size={16} />
              </button>
            </div>

            {/* Welcome Hero Wordmark OR Step Icon */}
            {isWelcome ? (
              <div className="bg-page/80 border border-border rounded-2xl p-5 flex flex-col items-center text-center gap-3">
                <BrandWordmark height={44} />
                <span className="px-3 py-1 rounded-full bg-primary/12 text-primary border border-primary/25 text-xs font-extrabold">
                  Interactive Quick-Start Guide
                </span>
              </div>
            ) : (
              <div
                className={`w-13 h-13 rounded-2xl border flex items-center justify-center shadow-2xs ${currentSlide.accentColor}`}
              >
                <Icon size={26} />
              </div>
            )}

            {/* Title & Description */}
            <div className="flex flex-col gap-2">
              <h3 className="text-xl sm:text-2xl font-extrabold text-main tracking-tight leading-snug">
                {currentSlide.title}
              </h3>
              <p className="text-sm text-muted leading-relaxed">{currentSlide.description}</p>
            </div>

            {/* Step-by-Step How-To Bullets */}
            <div className="bg-page/90 border border-border rounded-2xl p-4 flex flex-col gap-2.5">
              {currentSlide.howToBullets.map((bullet, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-main">
                  <CheckCircle2
                    size={16}
                    className={`shrink-0 mt-0.5 ${
                      currentSlide.kind === 'pro-bonus' ? 'text-amber-400' : 'text-emerald-500'
                    }`}
                  />
                  <span className="font-medium leading-relaxed">{bullet}</span>
                </div>
              ))}
            </div>

            {/* Pro Tip Callout */}
            <div className="bg-primary/8 border border-primary/20 rounded-2xl px-4 py-3 text-xs font-semibold text-main leading-relaxed">
              💡 {currentSlide.highlightTip}
            </div>

            {/* Bonus Pro Plans Button on Final Slide */}
            {currentSlide.kind === 'pro-bonus' && onOpenProPlans && (
              <button
                type="button"
                onClick={() => {
                  handleComplete();
                  onOpenProPlans();
                }}
                className="w-full min-h-11 py-2.5 px-4 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/35 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                <Sparkles size={15} /> View Pro &amp; ₹49 Trip Pass Plans
              </button>
            )}

            {/* Progress Dots & Navigation Controls */}
            <div className="flex items-center justify-between pt-2 border-t border-border/60 gap-2">
              <div className="flex items-center gap-1.5">
                {TOUR_SLIDES.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setStepIndex(idx)}
                    aria-label={`Slide ${idx + 1}`}
                    className={`h-2 rounded-full transition-all ${
                      idx === stepIndex ? 'w-6 bg-primary' : 'w-2 bg-border hover:bg-muted'
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {stepIndex > 0 ? (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="min-h-10 px-3 rounded-xl bg-page border border-border text-xs font-bold text-main hover:bg-subtle flex items-center gap-1 transition-colors"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleComplete}
                    className="min-h-10 px-3 text-xs font-bold text-muted hover:text-main transition-colors"
                  >
                    Skip
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleNext}
                  className="min-h-10 px-5 py-2 premium-gradient-card text-white rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
                >
                  {isWelcome ? (
                    <>
                      Start Quick Guide <ArrowRight size={15} />
                    </>
                  ) : isLastSlide ? (
                    <>
                      Let&apos;s Split! <CheckCircle2 size={15} />
                    </>
                  ) : (
                    <>
                      Next <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
