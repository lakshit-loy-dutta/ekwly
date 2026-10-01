import { useState, useMemo, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, QrCode, Moon } from 'lucide-react';
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

import BottomSheet from './ui/BottomSheet';
import SessionRules from './session/SessionRules';
import ReceiptEditor from './session/ReceiptEditor';
import MembersList from './session/MembersList';
import ClaimManager from './session/ClaimManager';
import DebtMatrix from './session/DebtMatrix';
import QuickSplit from './session/QuickSplit';

interface Props {
  sessionId?: string | null;
  isHost: boolean;
}

export default function ActiveSession({ sessionId, isHost }: Props) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [direction, setDirection] = useState<number>(1);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [currentSessionId] = useState<string>(sessionId || utils.generateId());

  // --- 1. MULTIPLAYER SUPABASE HOOK ---
  const { isLoading, items, members, claims, actions } = useSession(
    sessionId ? currentSessionId : null
  );

  // --- 2. HOST INITIALIZATION & GUEST ROUTING ---
  useEffect(() => {
    if (!sessionId && isHost) {
      actions.createSessionInDB?.(currentSessionId);
    }
  }, []);

  useEffect(() => {
    if (!isHost && currentStep === 1) {
      setCurrentStep(3); // Auto-route guests to Members
    }
  }, [isHost]);

  // --- 3. TRANSFORM DB CLAIMS TO UI FORMAT ---
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

  // --- 4. SESSION STATE ---
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

  // --- FORM STATES ---
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

  // --- NAVIGATION & UI ACTIONS ---
  const navigate = (newStep: number) => {
    setDirection(newStep > currentStep ? 1 : -1);
    setCurrentStep(newStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleNativeTheme = () => {
    if (typeof window !== 'undefined' && (window as any).toggleTheme) {
      (window as any).toggleTheme();
    }
  };

  const handleToggleSc = (checked: boolean) => {
    setIsScApplicable(checked);
    if (!checked) {
      setServiceChargeRate(0);
      setScTaxPresetId('none');
    }
  };

  // --- TAX ACTIONS ---
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
    showToast(`Added ${newTaxName.trim()} preset.`, 'success');
  };

  const handleRemoveTaxPreset = (id: string) => {
    if (taxPresets.length <= 1) return showToast('You must have at least one tax preset.', 'error');
    setTaxPresets(taxPresets.filter((t) => t.id !== id));
    if (scTaxPresetId === id) setScTaxPresetId('none');
  };

  // --- ITEM ACTIONS (Cloud Synced) ---
  const handleSaveItem = () => {
    const priceParsed = parseFloat(newItemPrice);
    if (!newItemName.trim() || newItemQty <= 0 || isNaN(priceParsed) || priceParsed < 0)
      return showToast('Please fill in all item fields correctly.', 'error');
    const preset = taxPresets.find((t) => t.id === newItemTaxId);
    const taxRate = preset ? preset.rate / 100 : 0;
    const totalBase = newItemQty * priceParsed;

    if (editingItemId) {
      const updatedItem = {
        id: editingItemId,
        name: newItemName.trim(),
        qty: newItemQty,
        unitPrice: priceParsed,
        taxRate,
        taxPresetId: newItemTaxId,
        applySC: newItemApplySC,
        totalBase,
      };
      actions.updateItemInDB?.(updatedItem);
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

  // --- MULTIPLAYER DB ACTIONS ---
  const handleAddMember = async () => {
    if (!newMemberName.trim()) return showToast('Name cannot be empty.', 'error');
    await actions.addMemberToDB(newMemberName);
    setNewMemberName('');
  };

  const handleRemoveMember = (id: string) => {
    actions.removeMemberFromDB(id);
    setQsSelectedMembers(qsSelectedMembers.filter((mid) => mid !== id));
  };

  const handleUpdateClaim = (memberId: string, itemId: string, value: string) => {
    actions.updateClaimInDB(memberId, itemId, value);
  };

  const toggleQsMember = (id: string) => {
    setQsSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((mid) => mid !== id) : [...prev, id]
    );
  };

  const handleApplyQuickSplit = () => {
    const item = items.find((i) => i.id === qsItemId);
    if (!item) return;
    if (qsSelectedMembers.length === 0) return showToast('Select at least one member.', 'error');

    const fractionString = utils.getFractionString(item.qty, qsSelectedMembers.length);
    qsSelectedMembers.forEach((memberId) => {
      actions.updateClaimInDB(memberId, item.id, fractionString);
    });

    setQsSelectedMembers([]);
    showToast(`Divided ${item.name} evenly.`, 'success');
  };

  // --- FINAL MATH & DEBT MATRIX ---
  const handleCalculateDebtMatrix = () => {
    if (items.length === 0 || members.length === 0)
      return showToast('Need items and members to calculate.', 'error');

    const rawSubTotal = items.reduce((sum, item) => sum + item.totalBase, 0);
    const parsedDiscount = parseFloat(discountValue) || 0;

    let preTaxDiscount = 0;
    let postTaxDiscount = 0;
    if (discountType !== 'none' && discountMode === 'pre-tax') {
      preTaxDiscount =
        discountType === 'percentage' ? rawSubTotal * (parsedDiscount / 100) : parsedDiscount;
      preTaxDiscount = Math.min(preTaxDiscount, rawSubTotal);
    }
    const preTaxMultiplier = rawSubTotal > 0 ? (rawSubTotal - preTaxDiscount) / rawSubTotal : 1;

    let globalSummary: GlobalSummary = {
      totalQty: 0,
      rawSubTotal,
      discountAmount: 0,
      discountMode,
      subTotal: 0,
      taxBreakdown: {},
      serviceCharge: 0,
      grandTotal: 0,
    };
    const scTaxPreset = taxPresets.find((t) => t.id === scTaxPresetId);

    const addTaxToBreakdown = (
      preset: TaxPreset | undefined,
      amount: number,
      fallbackName: string
    ) => {
      if (amount <= 0) return;
      if (preset) {
        if (preset.split) {
          const names = utils.getSplitNames(preset.name);
          globalSummary.taxBreakdown[names.cgst] =
            (globalSummary.taxBreakdown[names.cgst] || 0) + amount / 2;
          globalSummary.taxBreakdown[names.sgst] =
            (globalSummary.taxBreakdown[names.sgst] || 0) + amount / 2;
        } else {
          globalSummary.taxBreakdown[preset.name] =
            (globalSummary.taxBreakdown[preset.name] || 0) + amount;
        }
      } else {
        globalSummary.taxBreakdown[fallbackName] =
          (globalSummary.taxBreakdown[fallbackName] || 0) + amount;
      }
    };

    items.forEach((item) => {
      const effectiveBase = item.totalBase * preTaxMultiplier;
      const itemTaxAmount = effectiveBase * item.taxRate;
      const itemSC = item.applySC ? effectiveBase * serviceChargeRate : 0;
      const itemSCTaxAmount = scTaxPreset && itemSC > 0 ? itemSC * (scTaxPreset.rate / 100) : 0;

      globalSummary.totalQty += item.qty;
      globalSummary.subTotal += effectiveBase;
      globalSummary.serviceCharge += itemSC;
      addTaxToBreakdown(
        taxPresets.find((t) => t.id === item.taxPresetId),
        itemTaxAmount,
        'Other Tax'
      );
      addTaxToBreakdown(scTaxPreset, itemSCTaxAmount, 'S.C. Tax');
    });

    let grossTotal =
      globalSummary.subTotal +
      globalSummary.serviceCharge +
      Object.values(globalSummary.taxBreakdown).reduce((a, b) => a + b, 0);

    if (discountType !== 'none' && discountMode === 'post-tax') {
      postTaxDiscount =
        discountType === 'percentage' ? grossTotal * (parsedDiscount / 100) : parsedDiscount;
      postTaxDiscount = Math.min(postTaxDiscount, grossTotal);
    }

    globalSummary.discountAmount = discountMode === 'pre-tax' ? preTaxDiscount : postTaxDiscount;
    globalSummary.grandTotal = grossTotal - postTaxDiscount;
    const postTaxMultiplier = grossTotal > 0 ? (grossTotal - postTaxDiscount) / grossTotal : 1;

    const individualBreakdowns: Record<string, IndividualBreakdown> = {};

    members.forEach((member) => {
      let subtotal = 0;
      let totalScAmount = 0;
      let consumedItems: { name: string; qtyString: string; cost: number }[] = [];

      items.forEach((item) => {
        const consumedQtyString = formattedClaims[member.id]?.[item.id] || '';
        const consumedQty = utils.parseQty(consumedQtyString);

        if (consumedQty > 0) {
          const proportion = consumedQty / item.qty;
          const effectiveBaseShare = proportion * item.totalBase * preTaxMultiplier;
          const itemTaxShare = effectiveBaseShare * item.taxRate;
          const scShare = item.applySC ? effectiveBaseShare * serviceChargeRate : 0;
          const scTaxShare = scTaxPreset && scShare > 0 ? scShare * (scTaxPreset.rate / 100) : 0;
          const finalCostShare = effectiveBaseShare + itemTaxShare;
          const finalScBurden = scShare + scTaxShare;

          subtotal += finalCostShare;
          totalScAmount += finalScBurden;
          consumedItems.push({
            name: item.name,
            qtyString: consumedQtyString || consumedQty.toString(),
            cost: finalCostShare,
          });
        }
      });

      const intermediateOwed = subtotal + totalScAmount;
      const finalOwed = intermediateOwed * postTaxMultiplier;

      individualBreakdowns[member.name] = {
        subtotal,
        serviceCharge: totalScAmount,
        totalOwed: finalOwed,
        items: consumedItems,
      };
    });

    setCalculationResult({ individualBreakdowns, globalSummary });
    navigate(5);
  };

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

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-page">
        <div className="animate-pulse text-primary font-bold">Syncing Session...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative bg-page">
      <div className="flex-none sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-surface border-b border-border shadow-sm">
        <div className="flex items-center gap-1">
          {currentStep > 1 && (isHost || currentStep > 3) ? (
            <button
              onClick={() => navigate(currentStep - 1)}
              className="p-2 -ml-2 rounded-full text-primary active:bg-subtle transition-colors"
            >
              <ChevronLeft size={26} strokeWidth={2.5} />
            </button>
          ) : (
            <div className="w-10"></div>
          )}
          <h1 className="text-[1.1rem] font-semibold text-main tracking-tight">
            {currentStep === 1 && 'Session Rules'}
            {currentStep === 2 && 'Receipt Items'}
            {currentStep === 3 && 'Members'}
            {currentStep === 4 && 'Claims'}
            {currentStep === 5 && 'Bill Summary'}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleNativeTheme}
            className="p-2 rounded-full text-muted active:bg-subtle transition-colors"
          >
            <Moon size={22} />
          </button>
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="p-2 -mr-1 rounded-full text-primary active:bg-subtle transition-colors"
          >
            <QrCode size={22} />
          </button>
        </div>
      </div>

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
                handleUpdateClaim={handleUpdateClaim}
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
              <DebtMatrix
                calculationResult={calculationResult}
                receiptTitle={receiptTitle}
                setReceiptTitle={setReceiptTitle}
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

      {currentStep < 5 && (
        <div className="fixed bottom-0 w-full max-w-2xl mx-auto p-4 bg-surface/90 backdrop-blur-md border-t border-border z-30 pb-safe">
          {currentStep === 1 && (
            <button
              onClick={() => navigate(2)}
              className="w-full h-12 bg-primary active:bg-primary-hover text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors text-base shadow-sm"
            >
              Next: Add Items <ChevronRight size={20} />
            </button>
          )}
          {currentStep === 2 && (
            <button
              onClick={() => navigate(3)}
              className="w-full h-12 bg-primary active:bg-primary-hover text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors text-base shadow-sm"
            >
              Next: Members <ChevronRight size={20} />
            </button>
          )}
          {currentStep === 3 && (
            <button
              onClick={() => navigate(4)}
              className="w-full h-12 bg-primary active:bg-primary-hover text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors text-base shadow-sm"
            >
              Next: Claims <ChevronRight size={20} />
            </button>
          )}
          {currentStep === 4 && (
            <button
              onClick={
                isSplitComplete
                  ? handleCalculateDebtMatrix
                  : () => showToast('Finish splitting all items first.', 'error')
              }
              className={`w-full h-12 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors text-base shadow-sm ${isSplitComplete ? 'bg-primary active:bg-primary-hover' : 'bg-border text-muted cursor-not-allowed'}`}
            >
              {isSplitComplete ? 'Calculate Final Split' : 'Incomplete Claims'}{' '}
              <ChevronRight size={20} />
            </button>
          )}
        </div>
      )}

      <BottomSheet
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title="Invite to Session"
      >
        <div className="flex flex-col items-center">
          <p className="text-sm text-muted text-center mb-8">
            Scan this code from the Ekwly app home screen to join session{' '}
            <strong className="text-main">{currentSessionId}</strong>.
          </p>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-border mb-4">
            <QRCode
              value={`${typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''}?s=${currentSessionId}`}
              size={200}
            />
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
