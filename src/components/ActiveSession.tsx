import { useState, useMemo, useEffect, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Check } from 'lucide-react'; // Added Check
import type { CalculationResult } from '../lib/types';
import { utils, showToast } from '../lib/utils';
import { exportToPDF } from '../lib/pdf';
import { mathEngine } from '../lib/mathEngine';
import { SessionProvider, useSessionContext } from '../lib/SessionContext';

// LAZY LOADED COMPONENTS (Massive initial load speedup)
const SessionRules = lazy(() => import('./session/SessionRules'));
const ReceiptEditor = lazy(() => import('./session/ReceiptEditor'));
const MembersList = lazy(() => import('./session/MembersList'));
const ClaimManager = lazy(() => import('./session/ClaimManager'));
const Payments = lazy(() => import('./session/Payments'));
const DebtMatrix = lazy(() => import('./session/DebtMatrix'));
const QuickSplit = lazy(() => import('./session/QuickSplit'));
interface Props {
  sessionId?: string | null;
  pin?: string | null;
  isHost: boolean;
  currentStep: number;
  direction: number;
  navigate: (step: number) => void;
  onExit: () => void;
}

// 1. INNER COMPONENT: Consumes the global context cleanly
function ActiveSessionCore({
  sessionId,
  pin,
  currentStep,
  direction,
  navigate,
  onExit,
}: Props & { sessionId: string }) {
  const {
    isLoading,
    sessionStatus,
    sessionRules,
    taxPresets,
    ledger,
    items,
    members,
    claims,
    currentUserId,
    isHost,
    actions,
  } = useSessionContext();

  // Safe Room Initialization
  useEffect(() => {
    if (isHost && pin && sessionId) {
      actions.createSessionInDB?.(sessionId, pin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, sessionId, pin]);

  const formattedClaims = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    members.forEach((m) => {
      map[m.id] = {};
    });
    claims.forEach((c) => {
      if (!map[c.member_id]) map[c.member_id] = {};
      map[c.member_id][c.item_id] = c.value;
    });
    return map;
  }, [claims, members]);

  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);
  const [receiptTitle, setReceiptTitle] = useState<string>('');

  // Quick Split State (Needs to stay here because it spans multiple components in Step 4)
  const [qsItemId, setQsItemId] = useState<string>('');
  const [qsSelectedMembers, setQsSelectedMembers] = useState<string[]>([]);

  // Clean up ghost selections if a member is deleted
  useEffect(() => {
    setQsSelectedMembers((prev) => prev.filter((id) => members.some((m) => m.id === id)));
  }, [members]);

  useEffect(() => {
    if (items.length > 0 && (!qsItemId || !items.find((i) => i.id === qsItemId)))
      setQsItemId(items[0].id);
  }, [items, qsItemId]);

  const toggleQsMember = (id: string) => {
    setQsSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((mid) => mid !== id) : [...prev, id]
    );
  };

  const handleApplyQuickSplit = () => {
    const item = items.find((i) => i.id === qsItemId);
    if (!item) return showToast('Please select an item first.', 'error');
    if (qsSelectedMembers.length === 0) return showToast('Select at least one member.', 'error');

    const fractionString = utils.getFractionString(item.qty, qsSelectedMembers.length);

    // Build the batch array
    const updates = members
      .map((member) => {
        if (qsSelectedMembers.includes(member.id)) {
          return { memberId: member.id, itemId: item.id, value: fractionString };
        } else if (formattedClaims[member.id]?.[item.id]) {
          return { memberId: member.id, itemId: item.id, value: '' };
        }
        return null;
      })
      .filter(Boolean) as { memberId: string; itemId: string; value: string }[];

    // Send it all at once!
    actions.batchUpdateClaimsInDB?.(updates);
    setQsSelectedMembers([]);
    showToast(`Divided evenly.`, 'success');
  };

  const triggerMathCalculation = () => {
    return mathEngine.generateSplit({
      items,
      members,
      formattedClaims,
      discountType: sessionRules.discountType,
      discountMode: sessionRules.discountMode,
      discountValue: sessionRules.discountValue,
      taxPresets,
      scTaxPresetId: sessionRules.scTaxPresetId,
      serviceChargeRate: sessionRules.serviceChargeRate,
    });
  };

  const handleGenerateSettlement = () => {
    const totalPaid = members.reduce((sum, m) => sum + (m.paid_amount || 0), 0);
    const grandTotal = calculationResult!.globalSummary.grandTotal;

    if (Math.abs(totalPaid - grandTotal) > 0.05)
      return showToast('Payments must equal the Grand Total.', 'error');

    const transactions = mathEngine.generateTransactions(
      members,
      calculationResult!.individualBreakdowns
    );
    if (isHost) actions.saveLedgerToDB?.(transactions);
    navigate(6);
  };

  useEffect(() => {
    if (sessionStatus === 'locked' && items.length > 0 && members.length > 0) {
      setCalculationResult(triggerMathCalculation());
    }
  }, [sessionStatus, items, members, formattedClaims, sessionRules, taxPresets]);

  useEffect(() => {
    if (sessionStatus === 'locked' && currentStep !== 6) navigate(6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus]);

  const isSplitComplete =
    items.length > 0 &&
    members.length > 0 &&
    items.every((item) => {
      let claimed = 0;
      members.forEach((m) => (claimed += utils.parseQty(formattedClaims[m.id]?.[item.id])));
      return Math.abs(item.qty - claimed) < 0.01;
    });

  const slideVariants = {
    enter: (direction: number) => ({ x: direction > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({ x: direction < 0 ? '100%' : '-100%', opacity: 0 }),
  };

  if (isLoading)
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-primary font-bold">Syncing Session...</div>
      </div>
    );

  return (
    <div className="flex flex-col h-full relative bg-page">
      <div className="flex-1 overflow-x-hidden overflow-y-auto pb-32 relative no-scrollbar">
        <Suspense
          fallback={
            <div className="flex justify-center p-12">
              <div className="animate-pulse text-primary font-bold">Loading component...</div>
            </div>
          }
        >
          <AnimatePresence custom={direction} mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <SessionRules />
              </motion.div>
            )}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <ReceiptEditor />
              </motion.div>
            )}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <MembersList />
              </motion.div>
            )}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="flex flex-col"
              >
                {items.length > 0 && members.length > 0 && (
                  <QuickSplit
                    items={items}
                    members={members}
                    qsItemId={qsItemId}
                    setQsItemId={setQsItemId}
                    qsSelectedMembers={qsSelectedMembers}
                    toggleQsMember={toggleQsMember}
                    handleApplyQuickSplit={handleApplyQuickSplit}
                  />
                )}
                <ClaimManager
                  items={items}
                  members={members}
                  claims={formattedClaims}
                  handleUpdateClaim={actions.updateClaimInDB}
                />
              </motion.div>
            )}
            {currentStep === 5 && calculationResult && (
              <motion.div
                key="step5"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <Payments
                  isHost={isHost}
                  members={members}
                  grandTotal={calculationResult.globalSummary.grandTotal}
                  handleUpdatePayment={(id, val) =>
                    actions.updateMemberPaymentInDB?.(id, parseFloat(val) || 0)
                  }
                />
              </motion.div>
            )}
            {currentStep === 6 && calculationResult && (
              <motion.div
                key="step6"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <DebtMatrix
                  calculationResult={calculationResult}
                  receiptTitle={receiptTitle}
                  setReceiptTitle={setReceiptTitle}
                  sessionStatus={sessionStatus}
                  ledger={ledger}
                  isHost={isHost}
                  currentUserId={currentUserId}
                  venueName={sessionRules.venueName} // <-- NEW PROP
                  handleLockSession={() => actions.lockSessionInDB?.()}
                  handleUnlockSession={() => actions.unlockSessionInDB?.()}
                  handleToggleSettled={(id, current) =>
                    actions.toggleLedgerSettledInDB?.(id, current)
                  }
                  handleExportPDF={() =>
                    exportToPDF(
                      calculationResult,
                      receiptTitle || sessionRules.venueName, // <-- AUTO-FALLBACK
                      items,
                      taxPresets,
                      sessionRules.scTaxPresetId,
                      sessionRules.serviceChargeRate,
                      members, // <-- PASS MEMBERS TO PDF
                      ledger // <-- PASS LEDGER TO PDF
                    )
                  }
                  handleGoHome={onExit}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </Suspense>
      </div>

      {/* FIXED BOTTOM STEPPER UI */}
      {currentStep < 6 && (
        <div className="fixed bottom-0 w-full max-w-2xl mx-auto bg-surface/95 backdrop-blur-xl border-t border-border z-30 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          {/* THE INTERACTIVE STEPPER TRACK */}
          <div className="flex justify-between items-center px-8 pt-4 pb-3 relative">
            {/* Background connecting line */}
            <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-border -translate-y-[2px] z-0"></div>

            {[1, 2, 3, 4, 5].map((step) => {
              const isActive = currentStep === step;
              const isPassed = currentStep > step;
              return (
                <button
                  key={step}
                  onClick={() => {
                    if (step > currentStep) {
                      // Validate forward movement: don't let them skip to payments without finishing claims
                      if (step >= 5 && !isSplitComplete)
                        return showToast('Finish splitting items first', 'error');
                    }
                    navigate(step);
                  }}
                  className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-[0.8rem] font-bold transition-all duration-300 ${
                    isActive
                      ? 'bg-primary text-white shadow-[0_0_0_4px_rgba(0,128,255,0.15)] scale-110'
                      : isPassed
                        ? 'bg-primary text-white'
                        : 'bg-page border border-border text-muted hover:border-primary/50 hover:text-primary'
                  }`}
                >
                  {isPassed ? <Check size={14} strokeWidth={3} /> : step}
                </button>
              );
            })}
          </div>

          {/* THE MAIN ACTION BUTTON */}
          <div className="px-4 pb-4">
            {currentStep === 1 && (
              <button
                onClick={() => navigate(2)}
                className="w-full h-12 bg-primary active:bg-primary-hover text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                Next: Add Items <ChevronRight size={18} />
              </button>
            )}
            {currentStep === 2 && (
              <button
                onClick={() => navigate(3)}
                className="w-full h-12 bg-primary active:bg-primary-hover text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                Next: Members <ChevronRight size={18} />
              </button>
            )}
            {currentStep === 3 && (
              <button
                onClick={() => navigate(4)}
                className="w-full h-12 bg-primary active:bg-primary-hover text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                Next: Claims <ChevronRight size={18} />
              </button>
            )}
            {currentStep === 4 && (
              <button
                onClick={
                  isSplitComplete
                    ? () => {
                        setCalculationResult(triggerMathCalculation());
                        navigate(5);
                      }
                    : () => showToast('Finish splitting all items first.', 'error')
                }
                className={`w-full h-12 font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors ${isSplitComplete ? 'bg-primary text-white active:bg-primary-hover' : 'bg-surface border border-border text-muted opacity-75'}`}
              >
                {isSplitComplete ? 'Next: Enter Payments' : 'Incomplete Claims'}{' '}
                <ChevronRight size={18} />
              </button>
            )}
            {currentStep === 5 && isHost && (
              <button
                onClick={handleGenerateSettlement}
                className="w-full h-12 bg-success hover:bg-success-dark active:scale-95 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <Check size={18} /> Calculate Settlement
              </button>
            )}
            {currentStep === 5 && !isHost && (
              <div className="w-full h-12 bg-subtle text-muted font-bold rounded-xl flex items-center justify-center shadow-sm border border-border">
                Waiting for Host...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 2. OUTER COMPONENT: Wraps the core in the Context Provider
export default function ActiveSession(props: Props) {
  const [currentSessionId] = useState<string>(props.sessionId || utils.generateId());

  return (
    <SessionProvider sessionId={currentSessionId} isHost={props.isHost}>
      <ActiveSessionCore {...props} sessionId={currentSessionId} />
    </SessionProvider>
  );
}
