import { useState, useEffect } from 'react';
import { ChevronDown, Trash2, Info } from 'lucide-react';
import BottomSheet from '../ui/BottomSheet';
import { useSessionContext } from '../../lib/SessionContext';
import { showToast, utils } from '../../lib/utils';

export default function SessionRules() {
  // 1. Pull directly from Context instead of Props!
  const { isHost, sessionRules, taxPresets, actions } = useSessionContext();

  // 2. Local State Encapsulation (ActiveSession no longer cares about this)
  const [localDiscount, setLocalDiscount] = useState<string>(sessionRules.discountValue);
  const [localScRate, setLocalScRate] = useState<number>(sessionRules.serviceChargeRate * 100);
  const [newTaxName, setNewTaxName] = useState<string>('');
  const [newTaxRate, setNewTaxRate] = useState<string>('');
  const [newTaxSplit, setNewTaxSplit] = useState<boolean>(true);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    if (isHost && !localStorage.getItem('ekwly_tax_tutorial_seen')) {
      setShowTutorial(true);
    }
  }, [isHost]);

  const dismissTutorial = () => {
    localStorage.setItem('ekwly_tax_tutorial_seen', 'true');
    setShowTutorial(false);
  };

  // 3. Debounced Database Writes moved internally
  useEffect(() => {
    setLocalDiscount(sessionRules.discountValue);
  }, [sessionRules.discountValue]);
  useEffect(() => {
    setLocalScRate(sessionRules.serviceChargeRate * 100);
  }, [sessionRules.serviceChargeRate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localDiscount !== sessionRules.discountValue) {
        actions.updateSessionRulesInDB({ discountValue: localDiscount });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localDiscount, sessionRules.discountValue, actions]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const parsed = localScRate / 100;
      if (parsed !== sessionRules.serviceChargeRate) {
        actions.updateSessionRulesInDB({ serviceChargeRate: parsed });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localScRate, sessionRules.serviceChargeRate, actions]);

  const handleAddTaxPreset = () => {
    const rate = parseFloat(newTaxRate);
    if (!newTaxName.trim()) return showToast('Preset name is required.', 'error');
    if (isNaN(rate) || rate < 0) return showToast('Valid tax rate is required.', 'error');
    actions.addTaxPresetToDB({
      id: utils.generateId(),
      name: newTaxName.trim(),
      rate,
      split: newTaxSplit,
    });
    setNewTaxName('');
    setNewTaxRate('');
    setNewTaxSplit(true);
    showToast(`Added preset.`, 'success');
  };

  return (
    <div className="w-full flex flex-col">
      {/* SERVICE CHARGE SECTION */}
      <div className="px-4 py-3 mt-2 flex items-center justify-between">
        <h3 className="text-xs font-bold text-muted uppercase tracking-widest">Service Charge</h3>
        {isHost && (
          <button
            onClick={() => setShowTutorial(true)}
            className="text-primary p-1 active:opacity-70"
          >
            <Info size={16} />
          </button>
        )}
      </div>
      <div className="bg-surface border-y border-border px-4 py-2 flex flex-col">
        <label className="flex items-center justify-between py-3 cursor-pointer">
          <span className="text-[0.95rem] font-medium text-main">Enable Service Charge</span>
          {isHost ? (
            <div className="toggle-switch">
              <input
                type="checkbox"
                checked={sessionRules.isScApplicable}
                onChange={(e) =>
                  actions.updateSessionRulesInDB({
                    isScApplicable: e.target.checked,
                    ...(!e.target.checked ? { serviceChargeRate: 0, scTaxPresetId: 'none' } : {}),
                  })
                }
              />
              <span className="slider"></span>
            </div>
          ) : (
            <span className="text-sm font-bold text-muted">
              {sessionRules.isScApplicable ? 'ON' : 'OFF'}
            </span>
          )}
        </label>

        {sessionRules.isScApplicable && (
          <div className="grid grid-cols-2 gap-4 py-4 border-t border-border mt-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted uppercase">Rate (%)</label>
              {isHost ? (
                <input
                  type="number"
                  value={localScRate > 0 ? localScRate : ''}
                  placeholder="0"
                  min="0"
                  step="0.1"
                  onChange={(e) => setLocalScRate(parseFloat(e.target.value) || 0)}
                  className="h-10 px-3 bg-page border border-border rounded-lg text-[0.95rem] font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              ) : (
                <div className="h-10 px-3 bg-page border border-border rounded-lg text-[0.95rem] font-medium flex items-center">
                  {sessionRules.serviceChargeRate * 100}%
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted uppercase">Tax on S.C.</label>
              {isHost ? (
                <div className="relative">
                  <select
                    className="w-full h-10 pl-3 pr-8 appearance-none bg-page border border-border rounded-lg text-[0.95rem] font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={sessionRules.scTaxPresetId}
                    onChange={(e) =>
                      actions.updateSessionRulesInDB({ scTaxPresetId: e.target.value })
                    }
                  >
                    <option value="none">None</option>
                    {taxPresets.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.rate}%)
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-muted">
                    <ChevronDown size={16} />
                  </div>
                </div>
              ) : (
                <div className="h-10 px-3 bg-page border border-border rounded-lg text-[0.95rem] font-medium flex items-center">
                  {taxPresets.find((t) => t.id === sessionRules.scTaxPresetId)?.name || 'None'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* DISCOUNT SECTION */}
      <div className="px-4 py-3 mt-4">
        <h3 className="text-xs font-bold text-muted uppercase tracking-widest">Discount</h3>
      </div>
      <div className="bg-surface border-y border-border px-4 py-4 flex flex-col gap-4">
        <div className="flex items-center gap-1 bg-page p-1 rounded-lg border border-border">
          {(['none', 'percentage', 'flat'] as const).map((type) => (
            <button
              key={type}
              type="button"
              disabled={!isHost}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${sessionRules.discountType === type ? 'bg-surface shadow-sm text-main border border-border' : 'text-muted hover:text-main'}`}
              onClick={() => actions.updateSessionRulesInDB({ discountType: type })}
            >
              {type}
            </button>
          ))}
        </div>

        {sessionRules.discountType !== 'none' && (
          <div className="flex flex-col gap-4 pt-2 border-t border-border mt-1">
            <div className="flex items-center gap-1 bg-page p-1 rounded-lg border border-border">
              <button
                disabled={!isHost}
                onClick={() => actions.updateSessionRulesInDB({ discountMode: 'pre-tax' })}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${sessionRules.discountMode === 'pre-tax' ? 'bg-surface shadow-sm text-main border border-border' : 'text-muted hover:text-main'}`}
              >
                Pre-Tax
              </button>
              <button
                disabled={!isHost}
                onClick={() => actions.updateSessionRulesInDB({ discountMode: 'post-tax' })}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${sessionRules.discountMode === 'post-tax' ? 'bg-surface shadow-sm text-main border border-border' : 'text-muted hover:text-main'}`}
              >
                Post-Tax
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-[0.95rem] font-medium text-main">Discount Value</label>
              <div className="relative w-32">
                {sessionRules.discountType === 'flat' && (
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted font-bold text-[0.95rem]">
                    ₹
                  </div>
                )}
                <input
                  type="text"
                  inputMode="decimal"
                  disabled={!isHost}
                  value={localDiscount}
                  onChange={(e) => setLocalDiscount(e.target.value)}
                  placeholder="0"
                  style={{
                    paddingLeft: sessionRules.discountType === 'flat' ? '28px' : '12px',
                    paddingRight: sessionRules.discountType === 'percentage' ? '28px' : '12px',
                    textAlign: sessionRules.discountType === 'flat' ? 'left' : 'right',
                  }}
                  className="w-full h-10 bg-page border border-border rounded-lg text-[0.95rem] font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-75"
                />
                {sessionRules.discountType === 'percentage' && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted font-bold text-[0.95rem]">
                    %
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ADD TAX PRESET SECTION */}
      {isHost && (
        <>
          <div className="px-4 py-3 mt-4">
            <h3 className="text-xs font-bold text-muted uppercase tracking-widest">
              Add Tax Preset
            </h3>
          </div>
          <div className="bg-surface border-y border-border px-4 py-4 flex flex-col gap-4">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 sm:col-span-7 flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted uppercase">Name</label>
                <input
                  type="text"
                  value={newTaxName}
                  onChange={(e) => setNewTaxName(e.target.value)}
                  placeholder="e.g. GST"
                  className="w-full h-10 px-3 bg-page border border-border rounded-lg text-[0.95rem] font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div className="col-span-7 sm:col-span-3 flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted uppercase">Rate (%)</label>
                <input
                  type="number"
                  value={newTaxRate}
                  onChange={(e) => setNewTaxRate(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.1"
                  className="w-full h-10 px-3 text-center bg-page border border-border rounded-lg text-[0.95rem] font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div className="col-span-5 sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-bold opacity-0 select-none hidden sm:block">
                  Split
                </label>
                <div className="flex-1 flex items-center justify-center sm:justify-start">
                  <label className="flex items-center gap-2 cursor-pointer w-full justify-center">
                    <div className="toggle-switch scale-90">
                      <input
                        type="checkbox"
                        checked={newTaxSplit}
                        onChange={(e) => setNewTaxSplit(e.target.checked)}
                      />
                      <span className="slider"></span>
                    </div>
                    <span className="text-xs font-bold text-muted uppercase">Split</span>
                  </label>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="h-10 w-full bg-primary active:bg-primary-hover text-white rounded-lg font-medium text-sm transition-colors shadow-sm mt-1"
              onClick={handleAddTaxPreset}
            >
              Add Preset
            </button>
          </div>
        </>
      )}

      {/* ACTIVE PRESETS */}
      <div className="px-4 py-3 mt-4">
        <h3 className="text-xs font-bold text-muted uppercase tracking-widest">
          Active Presets ({taxPresets.length})
        </h3>
      </div>
      <div className="bg-surface border-y border-border divide-y divide-border">
        {taxPresets.map((t) => (
          <div key={t.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-main text-[0.95rem]">{t.name}</span>
              <span className="text-xs font-bold text-muted bg-page px-1.5 py-0.5 rounded border border-border">
                {t.rate}%
              </span>
              {t.split && (
                <span className="text-[0.65rem] font-bold text-primary bg-primary-light px-1.5 py-0.5 rounded uppercase tracking-wider">
                  Split
                </span>
              )}
            </div>
            {isHost && (
              <button
                onClick={() => actions.removeTaxPresetFromDB(t.id)}
                className="text-muted active:text-danger p-1"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        ))}
      </div>
      {/* FIRST TIME TUTORIAL */}
      <BottomSheet
        isOpen={showTutorial}
        onClose={dismissTutorial}
        title="How Ekwly Calculates Taxes"
      >
        <div className="flex flex-col gap-4 text-[0.95rem] text-main leading-relaxed">
          <p>
            Restaurant bills can be confusing. Here is exactly how to set up your room so the math
            matches the receipt perfectly:
          </p>
          <ul className="flex flex-col gap-3 ml-4 list-disc text-muted">
            <li>
              <strong className="text-main">Service Charge (S.C.):</strong> This is a global fee
              applied to the entire bill. Turn it on here in Step 1.
            </li>
            <li>
              <strong className="text-main">Tax Presets:</strong> Define your taxes here in Step 1
              (e.g., 5% Food GST, 20% Alcohol VAT).
            </li>
            <li>
              <strong className="text-main">Applying Taxes:</strong> In Step 2, as you add each
              item, you assign it the correct Tax Preset. Ekwly handles all the fractional math for
              you!
            </li>
          </ul>
          <button
            onClick={dismissTutorial}
            className="mt-4 w-full h-12 bg-primary text-white rounded-xl font-bold active:scale-95 transition-all shadow-sm"
          >
            Got it, let's start!
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
