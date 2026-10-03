import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, QrCode, Moon, Trash2 } from 'lucide-react';
import type {
  TaxPreset,
  BillItem,
  IndividualBreakdown,
  GlobalSummary,
  CalculationResult,
} from '../lib/types';
import { utils, showToast } from '../lib/utils';
import { exportToPDF } from '../lib/pdf';
import { useSession } from '../lib/useSession';
import { mathEngine } from '../lib/mathEngine';

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

export default function ActiveSession({
  sessionId,
  pin,
  isHost,
  currentStep,
  direction,
  navigate,
  onExit,
}: Props) {
  const [currentSessionId] = useState<string>(sessionId || utils.generateId());

  const { isLoading, sessionStatus, ledger, items, members, claims, currentUserId, actions } =
    useSession(sessionId ? currentSessionId : null);

  useEffect(() => {
    if (isHost && pin) actions.createSessionInDB?.(currentSessionId, pin);
  }, [isHost, currentSessionId, pin, actions]);

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

  const [serviceChargeRate, setServiceChargeRate] = useState<number>(0);
  const [isScApplicable, setIsScApplicable] = useState<boolean>(false);
  const [scTaxPresetId, setScTaxPresetId] = useState<string>('none');
  const [discountType, setDiscountType] = useState<'none' | 'percentage' | 'flat'>('none');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [discountMode, setDiscountMode] = useState<'pre-tax' | 'post-tax'>('post-tax');
  const [taxPresets, setTaxPresets] = useState<TaxPreset[]>([
    { id: 'tx-1', name: 'Food GST', rate: 5, split: true },
    { id: 'tx-2', name: 'Alcohol VAT', rate: 6, split: false },
    { id: 'tx-4', name: 'Exempt', rate: 0, split: false },
  ]);

  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);
  const [receiptTitle, setReceiptTitle] = useState<string>('');
  const [newTaxName, setNewTaxName] = useState<string>('');
  const [newTaxRate, setNewTaxRate] = useState<string>('');
  const [newTaxSplit, setNewTaxSplit] = useState<boolean>(true);
  const [newItemName, setNewItemName] = useState<string>('');
  const [newItemQty, setNewItemQty] = useState<number>(1);
  const [newItemPrice, setNewItemPrice] = useState<string>('');
  const [newItemTaxId, setNewItemTaxId] = useState<string>('tx-1');
  const [newItemApplySC, setNewItemApplySC] = useState<boolean>(true);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [newMemberName, setNewMemberName] = useState<string>('');
  const [qsItemId, setQsItemId] = useState<string>('');
  const [qsSelectedMembers, setQsSelectedMembers] = useState<string[]>([]);

  useEffect(() => {
    if (items.length > 0) {
      if (!qsItemId || !items.find((i) => i.id === qsItemId)) setQsItemId(items[0].id);
    }
  }, [items, qsItemId]);

  const handleToggleSc = (checked: boolean) => {
    setIsScApplicable(checked);
    if (!checked) {
      setServiceChargeRate(0);
      setScTaxPresetId('none');
    }
  };

  const handleAddTaxPreset = () => {
    const rate = parseFloat(newTaxRate);
    if (!newTaxName.trim()) return showToast('Preset name is required.', 'error');
    if (isNaN(rate) || rate < 0) return showToast('Valid tax rate is required.', 'error');
    setTaxPresets([
      ...taxPresets,
      { id: utils.generateId(), name: newTaxName.trim(), rate, split: newTaxSplit },
    ]);
    setNewTaxName('');
    setNewTaxRate('');
    setNewTaxSplit(true);
    showToast(`Added preset.`, 'success');
  };

  const handleRemoveTaxPreset = (id: string) => {
    if (taxPresets.length <= 1) return showToast('You must have at least one tax preset.', 'error');
    setTaxPresets(taxPresets.filter((t) => t.id !== id));
    if (scTaxPresetId === id) setScTaxPresetId('none');
  };

  const handleSaveItem = () => {
    const priceParsed = parseFloat(newItemPrice);
    if (!newItemName.trim() || newItemQty <= 0 || isNaN(priceParsed) || priceParsed < 0)
      return showToast('Fill all fields correctly.', 'error');
    const preset = taxPresets.find((t) => t.id === newItemTaxId);
    const taxRate = preset ? preset.rate / 100 : 0;
    const totalBase = newItemQty * priceParsed;

    if (editingItemId) {
      actions.updateItemInDB?.({
        id: editingItemId,
        name: newItemName.trim(),
        qty: newItemQty,
        unitPrice: priceParsed,
        taxRate,
        taxPresetId: newItemTaxId,
        applySC: newItemApplySC,
        totalBase,
      });
      setEditingItemId(null);
    } else {
      const newItem = {
        id: utils.generateId(),
        name: newItemName.trim(),
        qty: newItemQty,
        unitPrice: priceParsed,
        taxRate,
        taxPresetId: newItemTaxId,
        applySC: newItemApplySC,
        totalBase,
      };
      actions.addItemToDB?.(newItem);
      if (!qsItemId) setQsItemId(newItem.id);
    }
    setNewItemName('');
    setNewItemQty(1);
    setNewItemPrice('');
  };

  const handleEditItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setNewItemName(item.name);
    setNewItemQty(item.qty);
    setNewItemPrice(item.unitPrice.toString());
    setNewItemTaxId(item.taxPresetId);
    setNewItemApplySC(item.applySC);
    setEditingItemId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRemoveItem = (id: string) => {
    actions.removeItemFromDB?.(id);
    if (qsItemId === id) setQsItemId('');
  };

  const handleAddMember = async (selectedName?: string, selectedUserId?: string) => {
    const finalName = selectedName || newMemberName;
    if (!finalName.trim()) return showToast('Name cannot be empty.', 'error');

    await actions.addMemberToDB(finalName, selectedUserId);
    setNewMemberName(''); // Clear the input field after adding
  };

  const handleRemoveMember = (id: string) => {
    actions.removeMemberFromDB(id);
    setQsSelectedMembers(qsSelectedMembers.filter((mid) => mid !== id));
  };

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

  // --- SPLITWISE GREEDY ALGORITHM ---
  // --- MATH ENGINE DELEGATION ---
  const triggerMathCalculation = () => {
    return mathEngine.generateSplit({
      items,
      members,
      formattedClaims,
      discountType,
      discountMode,
      discountValue,
      taxPresets,
      scTaxPresetId,
      serviceChargeRate,
    });
  };

  const handleGenerateSettlement = () => {
    const totalPaid = members.reduce((sum, m) => sum + (m.paid_amount || 0), 0);
    const grandTotal = calculationResult!.globalSummary.grandTotal;

    if (Math.abs(totalPaid - grandTotal) > 0.05) {
      return showToast('Payments must equal the Grand Total.', 'error');
    }

    const transactions = mathEngine.generateTransactions(
      members,
      calculationResult!.individualBreakdowns
    );

    if (isHost) actions.saveLedgerToDB?.(transactions);
    navigate(6); // Move to Debt Matrix
  };

  useEffect(() => {
    if (sessionStatus === 'locked' && items.length > 0 && members.length > 0) {
      if (!calculationResult) setCalculationResult(triggerMathCalculation());
      if (currentStep !== 6) navigate(6);
    }
  }, [sessionStatus, items, members]);

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
              <SessionRules
                isHost={isHost}
                isScApplicable={isScApplicable}
                handleToggleSc={handleToggleSc}
                serviceChargeRate={serviceChargeRate}
                setServiceChargeRate={setServiceChargeRate}
                scTaxPresetId={scTaxPresetId}
                setScTaxPresetId={setScTaxPresetId}
                discountType={discountType}
                setDiscountType={setDiscountType}
                discountValue={discountValue}
                setDiscountValue={setDiscountValue}
                discountMode={discountMode}
                setDiscountMode={setDiscountMode}
                taxPresets={taxPresets}
                handleAddTaxPreset={handleAddTaxPreset}
                handleRemoveTaxPreset={handleRemoveTaxPreset}
                newTaxName={newTaxName}
                setNewTaxName={setNewTaxName}
                newTaxRate={newTaxRate}
                setNewTaxRate={setNewTaxRate}
                newTaxSplit={newTaxSplit}
                setNewTaxSplit={setNewTaxSplit}
              />
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
              <ReceiptEditor
                isHost={isHost}
                items={items}
                taxPresets={taxPresets}
                serviceChargeRate={serviceChargeRate}
                scTaxPresetId={scTaxPresetId}
                newItemName={newItemName}
                setNewItemName={setNewItemName}
                newItemQty={newItemQty}
                setNewItemQty={setNewItemQty}
                newItemPrice={newItemPrice}
                setNewItemPrice={setNewItemPrice}
                newItemTaxId={newItemTaxId}
                setNewItemTaxId={setNewItemTaxId}
                newItemApplySC={newItemApplySC}
                setNewItemApplySC={setNewItemApplySC}
                editingItemId={editingItemId}
                handleSaveItem={handleSaveItem}
                handleEditItem={handleEditItem}
                handleRemoveItem={handleRemoveItem}
              />
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
              <MembersList
                members={members}
                newMemberName={newMemberName}
                setNewMemberName={setNewMemberName}
                handleAddMember={handleAddMember}
                handleRemoveMember={handleRemoveMember}
                currentUserId={currentUserId}
                handleClaimProfile={actions.claimMemberIdentity!}
              />
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
                    scTaxPresetId,
                    serviceChargeRate
                  )
                }
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
