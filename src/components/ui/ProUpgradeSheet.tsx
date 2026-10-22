import { useState } from 'react';
import BottomSheet from './BottomSheet';
import { EKWLY_PLANS, launchProCheckout, type EkwlyPlanId } from '../../lib/razorpay';
import { utils } from '../../lib/utils';
import { Sparkles, Check, ShieldCheck, Zap } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  reasonTitle?: string;
  onActivated?: () => void;
}

export default function ProUpgradeSheet({
  isOpen,
  onClose,
  userId,
  userEmail,
  userName,
  reasonTitle = 'Upgrade to Ekwly Pro',
  onActivated,
}: Props) {
  const [selectedPlan, setSelectedPlan] = useState<EkwlyPlanId>('pro_monthly');
  const [isLaunching, setIsLaunching] = useState(false);

  const activeSpec = EKWLY_PLANS.find((p) => p.id === selectedPlan) || EKWLY_PLANS[1];

  const handleCheckout = async () => {
    utils.haptic('medium');
    setIsLaunching(true);
    try {
      await launchProCheckout({
        planId: selectedPlan,
        userId,
        userEmail,
        userName,
        onSuccess: () => {
          onClose();
          if (onActivated) onActivated();
        },
      });
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={reasonTitle}>
      <div className="flex flex-col gap-4 pb-4">
        <div className="flex items-center gap-3 bg-primary/8 border border-primary/25 rounded-2xl p-3.5">
          <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-sm">
            <Sparkles size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-extrabold text-main">
              Skip Manual Entry &amp; Unlock Deep Dining Insights
            </span>
            <span className="text-[0.7rem] text-muted leading-relaxed">
              Instant digital activation on your account via UPI, Cards, or NetBanking.
            </span>
          </div>
        </div>

        {/* 3-TIER PLAN SELECTOR */}
        <div className="flex flex-col gap-2.5">
          {EKWLY_PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => {
                  utils.haptic('light');
                  setSelectedPlan(plan.id);
                }}
                className={`p-3.5 rounded-2xl border text-left flex items-start justify-between gap-3 transition-all ${
                  isSelected
                    ? 'bg-primary/10 border-primary shadow-2xs'
                    : 'bg-page border-border hover:border-primary/40'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected ? 'bg-primary border-primary text-white' : 'border-border'
                    }`}
                  >
                    {isSelected && <Check size={12} />}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-main">{plan.name}</span>
                      <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[0.6rem] font-extrabold uppercase tracking-wider">
                        {plan.badge}
                      </span>
                    </div>
                    <span className="text-[0.7rem] text-muted leading-relaxed mt-0.5">
                      {plan.description}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0">
                  <span className="text-lg font-extrabold text-main tabular-nums">
                    ₹{plan.priceInr}
                  </span>
                  <span className="text-[0.62rem] font-bold text-muted">{plan.periodLabel}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* PRO BENEFITS CHECKLIST */}
        <div className="bg-page border border-border rounded-2xl p-3.5 grid grid-cols-2 gap-2 text-xs font-semibold text-main">
          <div className="flex items-center gap-1.5">
            <Zap size={14} className="text-primary shrink-0" /> Unlimited AI Bill Scans
          </div>
          <div className="flex items-center gap-1.5">
            <Zap size={14} className="text-emerald-500 shrink-0" /> Food vs Liquor Tax Audit
          </div>
          <div className="flex items-center gap-1.5">
            <Zap size={14} className="text-amber-500 shrink-0" /> Top Venues &amp; Debtors
          </div>
          <div className="flex items-center gap-1.5">
            <Zap size={14} className="text-primary shrink-0" /> 1-Tap CSV Expense Export
          </div>
        </div>

        <button
          type="button"
          disabled={isLaunching}
          onClick={handleCheckout}
          className="w-full h-12 premium-gradient-card text-white rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform disabled:opacity-60"
        >
          <Sparkles size={16} /> Unlock {activeSpec.name} — ₹{activeSpec.priceInr}
        </button>

        <div className="flex items-center justify-center gap-1.5 text-[0.68rem] text-muted font-medium text-center">
          <ShieldCheck size={13} className="text-emerald-500 shrink-0" />
          <span>100% Secure UPI &amp; Card Checkout • Instant Digital Activation</span>
        </div>
      </div>
    </BottomSheet>
  );
}
