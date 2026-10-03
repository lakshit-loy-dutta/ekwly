import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import type { CalculationResult } from '../lib/types';
import { utils, showToast } from '../lib/utils';
import { exportToPDF } from '../lib/pdf';
import { mathEngine } from '../lib/mathEngine';
import { SessionProvider, useSessionContext } from '../lib/SessionContext';

import SessionRules from './session/SessionRules';
import ReceiptEditor from './session/ReceiptEditor';
import MembersList from './session/MembersList';
import ClaimManager from './session/ClaimManager';
import Payments from './session/Payments';
import DebtMatrix from './session/DebtMatrix';
import QuickSplit from './session/QuickSplit';

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
    members.forEach((member) => {
      if (qsSelectedMembers.includes(member.id))
        actions.updateClaimInDB(member.id, item.id, fractionString);
      else if (formattedClaims[member.id]?.[item.id])
        actions.updateClaimInDB(member.id, item.id, '');
    });
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
      <div className="flex-1 overflow-x-hidden overflow-y-auto pb-24 relative no-scrollbar">
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
                handleLockSession={() => actions.lockSessionInDB?.()}
                handleUnlockSession={() => actions.unlockSessionInDB?.()}
                handleToggleSettled={(id, current) =>
                  actions.toggleLedgerSettledInDB?.(id, current)
                }
                handleExportPDF={() =>
                  exportToPDF(
                    calculationResult,
                    receiptTitle,
                    items,
                    taxPresets,
                    sessionRules.scTaxPresetId,
                    sessionRules.serviceChargeRate
                  )
                }
                handleGoHome={onExit}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {currentStep < 6 && (
        <div className="fixed bottom-0 w-full max-w-2xl mx-auto p-4 bg-surface/90 backdrop-blur-md border-t border-border z-30 pb-safe">
          {currentStep === 1 && (
            <button
              onClick={() => navigate(2)}
              className="w-full h-12 bg-primary text-white font-semibold rounded-xl flex items-center justify-center gap-2"
            >
              Next: Add Items <ChevronRight size={20} />
            </button>
          )}
          {currentStep === 2 && (
            <button
              onClick={() => navigate(3)}
              className="w-full h-12 bg-primary text-white font-semibold rounded-xl flex items-center justify-center gap-2"
            >
              Next: Members <ChevronRight size={20} />
            </button>
          )}
          {currentStep === 3 && (
            <button
              onClick={() => navigate(4)}
              className="w-full h-12 bg-primary text-white font-semibold rounded-xl flex items-center justify-center gap-2"
            >
              Next: Claims <ChevronRight size={20} />
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
              className={`w-full h-12 text-white font-semibold rounded-xl flex items-center justify-center gap-2 ${isSplitComplete ? 'bg-primary' : 'bg-border text-muted cursor-not-allowed'}`}
            >
              {isSplitComplete ? 'Next: Enter Payments' : 'Incomplete Claims'}{' '}
              <ChevronRight size={20} />
            </button>
          )}
          {currentStep === 5 && isHost && (
            <button
              onClick={handleGenerateSettlement}
              className="w-full h-12 bg-primary text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-sm"
            >
              Calculate Settlement <ChevronRight size={20} />
            </button>
          )}
          {currentStep === 5 && !isHost && (
            <div className="w-full h-12 bg-subtle text-muted font-semibold rounded-xl flex items-center justify-center shadow-sm">
              Waiting for Host to verify payments...
            </div>
          )}
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
