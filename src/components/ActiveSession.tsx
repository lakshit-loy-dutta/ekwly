import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Receipt, CreditCard, ArrowRight, Wallet, Trash2, Check, Users } from 'lucide-react';
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

  const assignSinglePayer = async (targetMemberId: string) => {
    if (!isHost || grandTotal <= 0) return;
    utils.haptic('light');
    await Promise.all(
      members.map((m) =>
        actions.updateMemberPaymentInDB(m.id, m.id === targetMemberId ? grandTotal : 0)
      )
    );
  };

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
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const handleUpdatePayment = (memberId: string, amountStr: string) => {
    const parsed = parseFloat(amountStr);
    actions.updateMemberPaymentInDB(memberId, isNaN(parsed) || parsed < 0 ? 0 : parsed);
  };

  const handleLockSession = async () => {
    if (items.length === 0) {
      return showToast('Add at least one item before locking the bill.', 'error');
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

  const handleExportPDF = (mode: 'download' | 'share' = 'download') => {
    utils.haptic('light');
    exportToPDF(
      liveCalculation,
      receiptTitle || initialName || sessionRules.venueName || 'Settlement Receipt',
      items,
      taxPresets,
      sessionRules.scTaxPresetId,
      sessionRules.serviceChargeRate,
      members,
      ledger,
      mode
    );
  };

  const handleDeleteRoom = async () => {
    await actions.deleteActiveSessionInDB();
    showToast('Session deleted.', 'success');
    onExit();
  };

  const activePayers = members.filter((m) => (m.paid_amount || 0) > 0.01);

  return (
    <div className="w-full flex flex-col flex-1 bg-page relative">
      <ConfirmSheet
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteRoom}
        title="Delete This Room?"
        description="This permanently deletes the current receipt, all items, and member claims for everyone in the room."
        confirmLabel="Delete Room"
        variant="danger"
      />

      {/* 2-TAB SEGMENTED WORKBENCH HEADER (High z-30 so scrolling content always passes underneath) */}
      <div className="sticky top-16 z-30 bg-surface/95 backdrop-blur-xl border-b border-border px-4 py-2.5 shadow-sm gpu-layer">
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col flex-1 relative z-10"
          >
            <ReceiptWorkbench />

            {isHost && (
              <div className="px-4 pt-2 pb-28 flex justify-center">
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col flex-1 pt-4 relative z-10"
          >
            {/* UPGRADED "WHO PAID THE RESTAURANT BILL?" CARD WITH 1-TAP PAYER CHIPS */}
            {sessionStatus !== 'locked' && (
              <div className="mx-4 mb-4 bg-surface border border-border rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Wallet size={15} className="text-primary" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-main">
                      Who Paid the Restaurant Bill?
                    </span>
                  </div>
                  <span className="text-xs font-extrabold text-primary tabular-nums">
                    {utils.formatMoney(grandTotal)}
                  </span>
                </div>

                <p className="text-[0.72rem] text-muted leading-relaxed -mt-1">
                  Tap the person who paid the waiter/cashier so everyone else&apos;s UPI links route
                  to them:
                </p>

                <div className="flex flex-wrap items-center gap-1.5">
                  {members.map((m) => {
                    const isSolePayer =
                      activePayers.length === 1 &&
                      activePayers[0].id === m.id &&
                      Math.abs(m.paid_amount - grandTotal) <= 0.5;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        disabled={!isHost}
                        onClick={() => assignSinglePayer(m.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all active:scale-95 ${
                          isSolePayer
                            ? 'bg-primary text-white border-primary shadow-2xs'
                            : 'bg-page text-main border-border hover:border-primary/40'
                        }`}
                      >
                        {isSolePayer && <Check size={13} />}
                        <span>{m.name}</span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => {
                      utils.haptic('light');
                      setShowPayerSheet(true);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${
                      activePayers.length > 1
                        ? 'bg-primary/15 text-primary border-primary/40'
                        : 'bg-page text-muted border-border hover:text-main'
                    }`}
                  >
                    <Users size={13} />
                    <span>
                      {activePayers.length > 1
                        ? `${activePayers.length} Payers Split Bill`
                        : 'Multiple Payers...'}
                    </span>
                  </button>
                </div>
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
                Grand Total ({items.length} {items.length === 1 ? 'item' : 'items'})
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
