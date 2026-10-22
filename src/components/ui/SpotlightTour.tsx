import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Receipt, Users, Wallet, ArrowRight, CheckCircle2, X } from 'lucide-react';
import { utils } from '../../lib/utils';
import { BrandLogo } from './BrandLoader';

interface TourStep {
  badge: string;
  title: string;
  description: string;
  highlightTip: string;
  icon: typeof Sparkles;
  accentColor: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    badge: 'Step 1 of 4 • AI Magic Scan',
    title: 'Snap Any Bill in 5 Seconds',
    description:
      'Skip typing items by hand. AI Magic Scan reads your paper receipt and automatically extracts dishes, quantities, and multi-bracket taxes.',
    highlightTip:
      'Or type a known restaurant name to auto-load its community-verified menu & tax rules!',
    icon: Sparkles,
    accentColor: 'text-primary bg-primary/12 border-primary/30',
  },
  {
    badge: 'Step 2 of 4 • Zero-Jargon Tax & Offer Routing',
    title: "Don't Pay the Teetotaler Tax",
    description:
      'Ekwly routes Food GST (5%), Liquor VAT, Service Charge, and Zomato/Swiggy discounts strictly to the people who ordered those items.',
    highlightTip:
      'Not sure how Service Charge was taxed? Enter the printed Grand Total and Ekwly auto-detects the exact formula.',
    icon: Receipt,
    accentColor: 'text-emerald-500 bg-emerald-500/12 border-emerald-500/30',
  },
  {
    badge: 'Step 3 of 4 • Saved Squads & 1-Tap Splits',
    title: 'Populate Your Table in 1 Tap',
    description:
      'Create Saved Squads (like "BLR Flatmates" or "Friday Crew") in the Friends tab to add your whole group at once, then tap names right on the receipt.',
    highlightTip: 'Works in Solo Mode (when you do the math yourself) or Live Sync via Invite QR.',
    icon: Users,
    accentColor: 'text-amber-500 bg-amber-500/12 border-amber-500/30',
  },
  {
    badge: 'Step 4 of 4 • Instant UPI QR & Netted Ledger',
    title: 'Collect via UPI QR or WhatsApp',
    description:
      'Lock the bill to generate 1-tap UPI links, show a live scan-to-pay UPI QR right on your phone screen, or track bilaterally netted debts in your Global Ledger.',
    highlightTip: 'Mutual debts with friends automatically offset each other to the exact paisa.',
    icon: Wallet,
    accentColor: 'text-primary bg-primary/12 border-primary/30',
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function SpotlightTour({ isOpen, onClose }: Props) {
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

  const currentStep = TOUR_STEPS[stepIndex];
  const Icon = currentStep.icon;
  const isLastStep = stepIndex === TOUR_STEPS.length - 1;

  const handleComplete = () => {
    utils.haptic('medium');
    localStorage.setItem('ekwly_tour_completed_v1', 'true');
    onClose();
  };

  const handleNext = () => {
    utils.haptic('light');
    if (isLastStep) {
      handleComplete();
    } else {
      setStepIndex((prev) => prev + 1);
    }
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
            className="fixed inset-0 bg-black/70 backdrop-blur-md"
          />

          <motion.div
            key={stepIndex}
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="relative z-10 w-full max-w-md bg-surface border border-border rounded-3xl p-6 shadow-2xl flex flex-col gap-5 overflow-hidden"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BrandLogo size={26} boxed />
                <span className="text-[0.68rem] font-extrabold uppercase tracking-widest text-primary">
                  {currentStep.badge}
                </span>
              </div>
              <button
                type="button"
                onClick={handleComplete}
                className="p-1.5 rounded-full bg-page border border-border text-muted hover:text-main transition-colors"
                aria-label="Skip tour"
              >
                <X size={16} />
              </button>
            </div>

            {/* Step Hero Icon & Copy */}
            <div className="flex flex-col gap-3">
              <div
                className={`w-13 h-13 rounded-2xl border flex items-center justify-center shadow-2xs ${currentStep.accentColor}`}
              >
                <Icon size={26} />
              </div>

              <h3 className="text-2xl font-extrabold text-main tracking-tight">
                {currentStep.title}
              </h3>

              <p className="text-sm text-muted leading-relaxed">{currentStep.description}</p>

              <div className="bg-page border border-border rounded-2xl p-3.5 flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-xs font-semibold text-main leading-relaxed">
                  {currentStep.highlightTip}
                </span>
              </div>
            </div>

            {/* Progress Dots & Navigation Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <div className="flex items-center gap-1.5">
                {TOUR_STEPS.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setStepIndex(idx)}
                    aria-label={`Go to step ${idx + 1}`}
                    className={`h-2 rounded-full transition-all ${
                      idx === stepIndex ? 'w-6 bg-primary' : 'w-2 bg-border hover:bg-muted'
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {!isLastStep && (
                  <button
                    type="button"
                    onClick={handleComplete}
                    className="h-10 px-3 text-xs font-bold text-muted hover:text-main transition-colors"
                  >
                    Skip
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleNext}
                  className="h-10 px-5 premium-gradient-card text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
                >
                  {isLastStep ? (
                    <>
                      Start Splitting <CheckCircle2 size={15} />
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
