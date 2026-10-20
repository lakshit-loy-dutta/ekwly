import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Receipt,
  CreditCard,
  ArrowRight,
  Wallet,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { SessionProvider, useSessionContext } from '../lib/SessionContext';
import { mathEngine } from '../lib/mathEngine';
import { exportToPDF } from '../lib/pdf';
import { utils, showToast } from '../lib/utils';
import ReceiptWorkbench from './session/ReceiptWorkbench';
import DebtMatrix from './session/DebtMatrix';
import Payments from './session/Payments';
import BottomSheet from './ui/BottomSheet';
import ConfirmSheet from './ui/ConfirmSheet';
import BrandLoader from './ui/BrandLoader';

interface Props {
  sessionId: string | null;
  pin: string | null;
  initialName?: string | null;
  isHost: boolean;
  onExit: () => void;
}

function ActiveSessionContent({
  sessionId,
  pin,
  initialName,
  onExit,
}: {
  sessionId: string | null;
  pin: string | null;
  initialName?: string | null;
  onExit: () => void;
}) {
  const {
    isLoading,
    isHost,
    items,
    members,
    taxPresets,
    sessionRules,
    sessionStatus,
    ledger,
    currentUserId,
    hostId,
    actions,
    liveCalculation,
  } = useSessionContext();

  const [activeTab, setActiveTab] = useState<'workbench' | 'settle'>('workbench');
  const [receiptTitle, setReceiptTitle] = useState('');
  const [showPayerSheet, setShowPayerSheet] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (sessionId && pin && isHost) {
      actions.createSessionInDB(sessionId, pin, initialName);
    }
  }, [sessionId, pin, isHost, initialName, actions]);

  useEffect(() => {
    if (sessionStatus === 'locked') {
      setActiveTab('settle');
    }
  }, [sessionStatus]);

  if (isLoading) {
    return <BrandLoader label="Syncing Room..." fullScreen />;
  }

  const grandTotal = liveCalculation.globalSummary.grandTotal;
  const totalPaid = members.reduce((sum, m) => sum + (m.paid_amount || 0), 0);
  const paymentDiff = utils.round2(grandTotal - totalPaid);
  const isPaymentBalanced = Math.abs(paymentDiff) <= 0.05;

  const applySmartCashierDefault = async () => {
    if (!isHost || members.length === 0 || grandTotal <= 0) return;
    if (totalPaid === 0) {
      const hostMember =
        members.find((m) => m.user_id && (m.user_id === hostId || m.user_id === currentUserId)) ||
        members[0];
      if (hostMember) {
        await actions.updateMemberPaymentInDB(hostMember.id, grandTotal);
      }
    }
  };

  const handleSwitchTab = async (tab: 'workbench' | 'settle') => {
    if (tab === activeTab) return;
    utils.haptic('light');
    if (tab === 'settle') {
      await applySmartCashierDefault();
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdatePayment = (memberId: string, amountStr: string) => {
    const parsed = parseFloat(amountStr);
    actions.updateMemberPaymentInDB(memberId, isNaN(parsed) || parsed < 0 ? 0 : parsed);
  };

  const handleLockSession = async () => {
    if (items.length === 0) {
      return showToast('Add at least one dish before locking the bill.', 'error');
    }

    let updatedMembers = [...members];
    const currentTotalPaid = updatedMembers.reduce((s, m) => s + (m.paid_amount || 0), 0);

    if (currentTotalPaid === 0 && updatedMembers.length > 0) {
      const hostMember =
        updatedMembers.find(
          (m) => m.user_id && (m.user_id === hostId || m.user_id === currentUserId)
        ) || updatedMembers[0];
      await actions.updateMemberPaymentInDB(hostMember.id, grandTotal);
      updatedMembers = updatedMembers.map((m) =>
        m.id === hostMember.id ? { ...m, paid_amount: grandTotal } : m
      );
    } else if (Math.abs(grandTotal - currentTotalPaid) > 0.5) {
      showToast('Cashier payments do not match the Grand Total. Adjust payer amounts.', 'error');
      setShowPayerSheet(true);
      return;
    }

    utils.haptic('heavy');
    const transactions = mathEngine.generateTransactions(
      updatedMembers,
      liveCalculation.individualBreakdowns
    );
    await actions.saveLedgerToDB(transactions);
    await actions.lockSessionInDB();
    showToast('Bill locked! UPI links & QR codes are ready.', 'success');
  };

  const handleUnlockSession = async () => {
    utils.haptic('medium');
    await actions.unlockSessionInDB();
    showToast('Bill unlocked for editing.', 'default');
  };

  const handleExportPDF = () => {
    utils.haptic('light');
    exportToPDF(
      liveCalculation,
      receiptTitle || sessionRules.venueName || initialName || 'Settlement Receipt',
      items,
      taxPresets,
      sessionRules.scTaxPresetId,
      sessionRules.serviceChargeRate,
      members,
      ledger
    );
  };

  const handleDeleteRoom = async () => {
    await actions.deleteActiveSessionInDB();
    showToast('Session deleted.', 'success');
    onExit();
  };

  const activePayers = members.filter((m) => (m.paid_amount || 0) > 0);
  const payerSummaryLabel =
    activePayers.length === 0
      ? 'No payer assigned'
      : activePayers.length === 1
        ? `${activePayers[0].name} paid ${utils.formatMoney(activePayers[0].paid_amount)}`
        : `${activePayers.length} people split cashier payment`;

  return (
    <div className="w-full flex flex-col flex-1 bg-page relative">
      <ConfirmSheet
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteRoom}
        title="Delete This Room?"
        description="This permanently deletes the current receipt, all dishes, and member claims for everyone in the room."
        confirmLabel="Delete Room"
        variant="danger"
      />

      {/* 2-TAB SEGMENTED WORKBENCH HEADER (Docks cleanly below the 64px top navbar) */}
      <div className="sticky top-16 z-30 bg-surface/95 backdrop-blur-xl border-b border-border px-4 py-2.5 shadow-2xs gpu-layer">
        <div className="bg-page border border-border rounded-2xl p-1 grid grid-cols-2 gap-1 relative">
          <button
            type="button"
            onClick={() => handleSwitchTab('workbench')}
            className={`relative py-2.5 px-3 rounded-xl text-xs font-extrabold tracking-tight flex items-center justify-center gap-2 transition-colors z-10 ${
              activeTab === 'workbench' ? 'text-white' : 'text-muted hover:text-main'
            }`}
          >
            {activeTab === 'workbench' && (
              <motion.div
                layoutId="ekwly-workbench-tab"
                transition={{ type: 'spring', stiffness: 500, damping: 34, mass: 0.8 }}
                className="absolute inset-0 bg-primary rounded-xl shadow-sm -z-10"
              />
            )}
            <Receipt size={15} />
            <span>1. Receipt &amp; Split</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchTab('settle')}
            className={`relative py-2.5 px-3 rounded-xl text-xs font-extrabold tracking-tight flex items-center justify-center gap-2 transition-colors z-10 ${
              activeTab === 'settle' ? 'text-white' : 'text-muted hover:text-main'
            }`}
          >
            {activeTab === 'settle' && (
              <motion.div
                layoutId="ekwly-workbench-tab"
                transition={{ type: 'spring', stiffness: 500, damping: 34, mass: 0.8 }}
                className="absolute inset-0 bg-primary rounded-xl shadow-sm -z-10"
              />
            )}
            <CreditCard size={15} />
            <span>2. Settle &amp; Collect</span>
          </button>
        </div>
      </div>

      {/* TAB BODY */}
      <AnimatePresence mode="wait" initial={false}>
        {activeTab === 'workbench' ? (
          <motion.div
            key="workbench"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="flex flex-col flex-1"
          >
            <ReceiptWorkbench />

            {isHost && (
              <div className="px-4 pb-32 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-xs font-bold text-muted hover:text-danger flex items-center gap-1.5 py-2 px-4 rounded-xl transition-colors"
                >
                  <Trash2 size={14} /> Delete Session Room
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="settle"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="flex flex-col flex-1 pt-4"
          >
            {/* SMART CASHIER PAYER BAR (DRAFT STATE ONLY) */}
            {sessionStatus !== 'locked' && (
              <div className="mx-4 mb-3 bg-surface border border-border rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isPaymentBalanced
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : 'bg-amber-500/15 text-amber-500'
                    }`}
                  >
                    {isPaymentBalanced ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted">
                      Who Paid the Cashier?
                    </span>
                    <span className="text-sm font-bold text-main truncate">
                      {payerSummaryLabel}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    utils.haptic('light');
                    setShowPayerSheet(true);
                  }}
                  className="h-9 px-3.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded-xl font-bold text-xs shrink-0 flex items-center gap-1.5 transition-colors"
                >
                  <Wallet size={14} /> Change Payer
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
              handleLockSession={handleLockSession}
              handleToggleSettled={actions.toggleLedgerSettledInDB}
              handleExportPDF={handleExportPDF}
              handleUnlockSession={handleUnlockSession}
              handleGoHome={onExit}
              venueName={sessionRules.venueName}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING BOTTOM SUMMARY & CTA BAR (ON TAB 1) */}
      {activeTab === 'workbench' && (
        <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none flex justify-center px-4 pb-4 pb-safe">
          <div className="pointer-events-auto w-full max-w-xl bg-surface/92 backdrop-blur-xl border border-border rounded-2xl p-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.25)] flex items-center justify-between gap-3 gpu-layer">
            <div className="flex flex-col pl-1">
              <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted">
                Grand Total ({items.length} {items.length === 1 ? 'dish' : 'dishes'})
              </span>
              <span className="text-xl font-extrabold text-main tabular-nums">
                {utils.formatMoney(grandTotal)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleSwitchTab('settle')}
              className="h-11 px-5 premium-gradient-card text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm active:scale-95 transition-transform"
            >
              Review &amp; Settle <ArrowRight size={17} />
            </button>
          </div>
        </div>
      )}

      {/* MULTI-PAYER CASHIER DRAWER */}
      <BottomSheet
        isOpen={showPayerSheet}
        onClose={() => setShowPayerSheet(false)}
        title="Split Cashier Payment"
      >
        <div className="flex flex-col gap-4 pb-4">
          <Payments
            isHost={isHost}
            members={members}
            grandTotal={grandTotal}
            handleUpdatePayment={handleUpdatePayment}
          />
          <button
            type="button"
            onClick={() => setShowPayerSheet(false)}
            className="w-full h-12 bg-primary text-white rounded-xl font-bold text-sm shadow-sm"
          >
            Done
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

export default function ActiveSession(props: Props) {
  return (
    <SessionProvider sessionId={props.sessionId} isHost={props.isHost}>
      <ActiveSessionContent
        sessionId={props.sessionId}
        pin={props.pin}
        initialName={props.initialName}
        onExit={props.onExit}
      />
    </SessionProvider>
  );
}
