import { useState, useEffect, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Receipt, Wallet, Check, Users, ChevronRight } from 'lucide-react';
import { utils, showToast } from '../lib/utils';
import { exportToPDF } from '../lib/pdf';
import { mathEngine } from '../lib/mathEngine';
import { SessionProvider, useSessionContext } from '../lib/SessionContext';
import BrandLoader from './ui/BrandLoader';
import BottomSheet from './ui/BottomSheet';

const ReceiptWorkbench = lazy(() => import('./session/ReceiptWorkbench'));
const DebtMatrix = lazy(() => import('./session/DebtMatrix'));
const Payments = lazy(() => import('./session/Payments'));

interface Props {
  sessionId?: string | null;
  pin?: string | null;
  isHost: boolean;
  currentStep: number;
  direction: number;
  navigate: (step: number) => void;
  onExit: () => void;
  initialName?: string | null;
}

function ActiveSessionCore({ sessionId, pin, initialName, onExit }: Props & { sessionId: string }) {
  const {
    isLoading,
    sessionStatus,
    sessionRules,
    taxPresets,
    ledger,
    items,
    members,
    currentUserId,
    isHost,
    actions,
    formattedClaims,
    liveCalculation,
  } = useSessionContext();

  const [activeTab, setActiveTab] = useState<'workbench' | 'settle'>('workbench');
  const [receiptTitle, setReceiptTitle] = useState<string>('');
  const [showMultiPayerSheet, setShowMultiPayerSheet] = useState(false);

  useEffect(() => {
    if (isHost && pin && sessionId) {
      actions.createSessionInDB(sessionId, pin, initialName);
    }
  }, [isHost, sessionId, pin, initialName]);

  useEffect(() => {
    if (sessionStatus === 'locked') {
      setActiveTab('settle');
    }
  }, [sessionStatus]);

  const isSplitComplete =
    items.length > 0 &&
    members.length > 0 &&
    items.every((item) => {
      let claimed = 0;
      members.forEach((m) => {
        claimed += utils.parseQty(formattedClaims[m.id]?.[item.id]);
      });
      return Math.abs(item.qty - claimed) < 0.01;
    });

  const grandTotal = liveCalculation.globalSummary.grandTotal;
  const totalPaid = members.reduce((sum, m) => sum + (m.paid_amount || 0), 0);
  const isPaymentBalanced = Math.abs(totalPaid - grandTotal) <= 0.05;

  // Smart Cashier Default: When moving to Settle tab, if ₹0 is recorded, auto-assign to Host/Me
  const handleProceedToSettle = async () => {
    if (!isSplitComplete) {
      return showToast('Assign all dishes to table members before settling.', 'error');
    }
    utils.haptic('medium');

    let updatedMembers = [...members];
    if (isHost && grandTotal > 0 && Math.abs(totalPaid - grandTotal) > 0.05) {
      const hostMember = members.find((m) => m.user_id === currentUserId) || members[0];
      if (hostMember && totalPaid === 0) {
        await actions.updateMemberPaymentInDB(hostMember.id, grandTotal);
        updatedMembers = members.map((m) =>
          m.id === hostMember.id ? { ...m, paid_amount: grandTotal } : m
        );
      }
    }

    const tx = mathEngine.generateTransactions(
      updatedMembers,
      liveCalculation.individualBreakdowns
    );
    if (isHost) {
      await actions.saveLedgerToDB(tx);
    }
    setActiveTab('settle');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading) {
    return <BrandLoader label="Syncing Room..." fullScreen />;
  }

  return (
    <div className="flex flex-col h-full relative bg-page min-h-screen">
      <div className="fixed inset-0 bg-grid-pattern z-0 pointer-events-none opacity-80" />

      {/* 2-TAB SEGMENTED SWITCHER */}
      <div className="sticky top-0 z-30 bg-page/90 backdrop-blur-md px-4 pt-3 pb-2 border-b border-border/60">
        <div className="grid grid-cols-2 gap-1.5 bg-surface border border-border p-1 rounded-2xl shadow-sm">
          <button
            type="button"
            onClick={() => {
              utils.haptic('light');
              setActiveTab('workbench');
            }}
            className={`relative py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'workbench' ? 'text-white' : 'text-muted hover:text-main'
            }`}
          >
            {activeTab === 'workbench' && (
              <motion.div
                layoutId="session-tab-pill"
                transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                className="absolute inset-0 bg-primary rounded-xl z-0 shadow-sm"
              />
            )}
            <Receipt size={14} className="relative z-10" />
            <span className="relative z-10">1. Receipt & Split</span>
          </button>

          <button
            type="button"
            onClick={handleProceedToSettle}
            className={`relative py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'settle' ? 'text-white' : 'text-muted hover:text-main'
            }`}
          >
            {activeTab === 'settle' && (
              <motion.div
                layoutId="session-tab-pill"
                transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                className="absolute inset-0 bg-primary rounded-xl z-0 shadow-sm"
              />
            )}
            <Wallet size={14} className="relative z-10" />
            <span className="relative z-10">2. Settle & Collect</span>
          </button>
        </div>
      </div>

      {/* MAIN WORKBENCH CONTENT */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto relative z-10 no-scrollbar">
        <Suspense fallback={<BrandLoader label="Loading Workbench..." />}>
          <AnimatePresence mode="wait">
            {activeTab === 'workbench' ? (
              <motion.div
                key="workbench"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              >
                <ReceiptWorkbench />
              </motion.div>
            ) : (
              <motion.div
                key="settle"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                className="flex flex-col pb-24"
              >
                {/* Cashier Payment Summary Banner (Replaces Mandatory Step 5) */}
                {sessionStatus !== 'locked' && (
                  <div className="mx-4 mt-4 mb-2 bg-surface border border-border rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted">
                        Paid the Restaurant Cashier
                      </span>
                      <span className="text-sm font-bold text-main mt-0.5">
                        {members
                          .filter((m) => m.paid_amount > 0)
                          .map((m) => `${m.name} (${utils.formatMoney(m.paid_amount)})`)
                          .join(', ') || 'No payer selected'}
                      </span>
                      {!isPaymentBalanced && (
                        <span className="text-xs font-bold text-danger mt-0.5">
                          Cashier payments ({utils.formatMoney(totalPaid)}) must match{' '}
                          {utils.formatMoney(grandTotal)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMultiPayerSheet(true)}
                      className="px-3 py-2 rounded-xl bg-primary/10 text-primary font-bold text-xs shrink-0 hover:bg-primary/20 transition-colors"
                    >
                      Change Payer
                    </button>
                  </div>
                )}

                <DebtMatrix
                  calculationResult={liveCalculation}
                  receiptTitle={receiptTitle}
                  setReceiptTitle={setReceiptTitle}
                  sessionStatus={sessionStatus}
                  ledger={ledger}
                  isHost={isHost}
                  currentUserId={currentUserId}
                  venueName={sessionRules.venueName}
                  handleLockSession={async () => {
                    if (!isPaymentBalanced) {
                      setShowMultiPayerSheet(true);
                      return showToast('Balance who paid the cashier first.', 'error');
                    }
                    const tx = mathEngine.generateTransactions(
                      members,
                      liveCalculation.individualBreakdowns
                    );
                    await actions.saveLedgerToDB(tx);
                    await actions.lockSessionInDB();
                  }}
                  handleUnlockSession={() => actions.unlockSessionInDB()}
                  handleToggleSettled={(id, current) =>
                    actions.toggleLedgerSettledInDB(id, current)
                  }
                  handleExportPDF={() =>
                    exportToPDF(
                      liveCalculation,
                      receiptTitle || sessionRules.venueName,
                      items,
                      taxPresets,
                      sessionRules.scTaxPresetId,
                      sessionRules.serviceChargeRate,
                      members,
                      ledger
                    )
                  }
                  handleGoHome={onExit}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </Suspense>
      </div>

      {/* FLOATING BOTTOM CTA ON WORKBENCH TAB */}
      {activeTab === 'workbench' && items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center px-4 pb-4 pb-safe pointer-events-none">
          <div className="w-full max-w-2xl bg-surface/95 backdrop-blur-xl border border-border rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-3 pointer-events-auto gpu-layer">
            <div className="flex flex-col pl-1">
              <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted">
                Grand Total
              </span>
              <span className="text-xl font-extrabold text-primary tabular-nums">
                {utils.formatMoney(grandTotal)}
              </span>
            </div>

            <button
              type="button"
              onClick={handleProceedToSettle}
              className={`h-12 px-6 rounded-xl font-bold text-sm flex items-center gap-2 transition-all active:scale-95 shadow-sm ${
                isSplitComplete
                  ? 'bg-success hover:bg-success-dark text-white'
                  : 'bg-page border border-border text-muted'
              }`}
            >
              {isSplitComplete ? (
                <>
                  <Check size={18} /> Review & Settle
                </>
              ) : (
                <>
                  Assign Remaining Items <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* MULTI-PAYER CASHIER DRAWER */}
      <BottomSheet
        isOpen={showMultiPayerSheet}
        onClose={() => setShowMultiPayerSheet(false)}
        title="Who Paid the Cashier?"
      >
        <div className="flex flex-col gap-4 pb-4">
          <Payments
            isHost={isHost}
            members={members}
            grandTotal={grandTotal}
            handleUpdatePayment={(id, val) =>
              actions.updateMemberPaymentInDB(id, parseFloat(val) || 0)
            }
          />
          <button
            type="button"
            onClick={async () => {
              const tx = mathEngine.generateTransactions(
                members,
                liveCalculation.individualBreakdowns
              );
              if (isHost) await actions.saveLedgerToDB(tx);
              setShowMultiPayerSheet(false);
            }}
            className="w-full h-12 bg-primary text-white font-bold rounded-xl shadow-sm"
          >
            Save Cashier Payments
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

export default function ActiveSession(props: Props) {
  const [currentSessionId] = useState<string>(props.sessionId || utils.generateId());

  return (
    <SessionProvider sessionId={currentSessionId} isHost={props.isHost}>
      <ActiveSessionCore {...props} sessionId={currentSessionId} />
    </SessionProvider>
  );
}
