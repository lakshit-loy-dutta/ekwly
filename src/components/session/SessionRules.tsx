import { useState, useEffect } from 'react';
import { ChevronDown, Trash2, Search, Loader2, Info, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSessionContext } from '../../lib/SessionContext';
import { showToast, utils } from '../../lib/utils';
import MagicScanner from './MagicScanner';
import SectionHeader from '../ui/SectionHeader';
import ToggleSwitch from '../ui/ToggleSwitch';
import type { DatabaseVenue } from '../../lib/types';

export default function SessionRules() {
  const { isHost, sessionRules, taxPresets, actions } = useSessionContext();

  const [localVenue, setLocalVenue] = useState<string>(sessionRules.venueName);
  const [venueResults, setVenueResults] = useState<any[]>([]);
  const [isSearchingVenue, setIsSearchingVenue] = useState(false);
  const [showVenueDropdown, setShowVenueDropdown] = useState(false);

  const [localDiscount, setLocalDiscount] = useState<string>(sessionRules.discountValue);
  // SELF-HEALING: If DB has a raw percentage (10) instead of a decimal (0.10), fix it instantly
  const safeScRate =
    sessionRules.serviceChargeRate > 1
      ? sessionRules.serviceChargeRate / 100
      : sessionRules.serviceChargeRate;

  const [localScRate, setLocalScRate] = useState<number>(safeScRate * 100);
  const [newTaxName, setNewTaxName] = useState<string>('');
  const [newTaxRate, setNewTaxRate] = useState<string>('');
  const [newTaxSplit, setNewTaxSplit] = useState<boolean>(true);

  // Global Help Reminder State
  const [showHelpReminder, setShowHelpReminder] = useState(false);
  useEffect(() => {
    if (isHost && !localStorage.getItem('ekwly_help_reminder_seen')) setShowHelpReminder(true);
  }, [isHost]);

  const dismissHelpReminder = () => {
    localStorage.setItem('ekwly_help_reminder_seen', 'true');
    setShowHelpReminder(false);
  };

  useEffect(() => {
    setLocalVenue(sessionRules.venueName);
  }, [sessionRules.venueName]);
  useEffect(() => {
    setLocalDiscount(sessionRules.discountValue);
  }, [sessionRules.discountValue]);
  useEffect(() => {
    setLocalScRate(safeScRate * 100);
  }, [safeScRate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localVenue !== sessionRules.venueName)
        actions.updateSessionRulesInDB({ venueName: localVenue });
    }, 500);
    return () => clearTimeout(timer);
  }, [localVenue, sessionRules.venueName, actions]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localDiscount !== sessionRules.discountValue)
        actions.updateSessionRulesInDB({ discountValue: localDiscount });
    }, 500);
    return () => clearTimeout(timer);
  }, [localDiscount, sessionRules.discountValue, actions]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const parsed = localScRate / 100;
      if (parsed !== sessionRules.serviceChargeRate)
        actions.updateSessionRulesInDB({ serviceChargeRate: parsed });
    }, 500);
    return () => clearTimeout(timer);
  }, [localScRate, sessionRules.serviceChargeRate, actions]);

  useEffect(() => {
    if (localVenue.trim().length < 2 || !isHost) {
      setVenueResults([]);
      setShowVenueDropdown(false);
      return;
    }
    const searchDb = async () => {
      setIsSearchingVenue(true);
      const { data } = await supabase.rpc('search_venues', { search_term: localVenue.trim() });
      if (data && data.length > 0) {
        if (data[0].name.toLowerCase() === localVenue.trim().toLowerCase())
          setShowVenueDropdown(false);
        else {
          setVenueResults(data);
          setShowVenueDropdown(true);
        }
      } else setShowVenueDropdown(false);
      setIsSearchingVenue(false);
    };
    const delayDebounceFn = setTimeout(() => searchDb(), 350);
    return () => clearTimeout(delayDebounceFn);
  }, [localVenue, isHost]);

  const handleSelectVenue = async (venue: DatabaseVenue) => {
    setLocalVenue(venue.name);
    setShowVenueDropdown(false);
    const parsedScRate = Number(venue.service_charge_rate || 0);
    setLocalScRate(parsedScRate * 100);

    actions.updateSessionRulesInDB({
      venueName: venue.name,
      isScApplicable: parsedScRate > 0,
      serviceChargeRate: parsedScRate,
    });
    if (venue.tax_presets && Array.isArray(venue.tax_presets)) {
      for (const t of taxPresets) await actions.removeTaxPresetFromDB(t.id);
      for (const t of venue.tax_presets) {
        await actions.addTaxPresetToDB({
          id: utils.generateId(),
          name: t.name,
          rate: t.rate,
          split: t.split !== false,
        });
      }
      showToast(`${venue.name} rules applied!`, 'success');
    }
  };

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
    <div className="w-full flex flex-col pb-8">
      {/* GLOBAL HELP REMINDER */}
      {showHelpReminder && isHost && (
        <div className="mx-4 mt-4 bg-primary text-white p-4 rounded-xl flex items-start gap-3 shadow-sm relative overflow-hidden">
          <Info size={20} className="shrink-0 mt-0.5 text-white/80" />
          <div className="flex flex-col pr-6">
            <h4 className="font-bold text-sm mb-1">Need help?</h4>
            <p className="text-[0.85rem] text-white/90 leading-snug">
              Tap the 'i' icon next to any section header for detailed instructions on how to use
              Ekwly.
            </p>
          </div>
          <button
            onClick={dismissHelpReminder}
            className="absolute top-3 right-3 p-1.5 text-white/70 hover:text-white bg-black/20 hover:bg-black/30 rounded-full transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 1. VENUE NAME (MOVED TO TOP) */}
      <SectionHeader
        title="Location"
        helpText="Search for a known restaurant first. This instantly loads their complex tax rules and significantly increases the Magic Scanner's accuracy."
      />
      <div className="bg-surface border-y border-border px-4 py-4 flex flex-col relative z-20">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted">
            {isSearchingVenue ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Search size={16} />
            )}
          </div>
          <input
            type="text"
            disabled={!isHost}
            value={localVenue}
            onChange={(e) => setLocalVenue(e.target.value)}
            placeholder="Where are you eating? (e.g., Toit Brewpub)"
            className="w-full h-12 bg-page border border-border rounded-xl px-4 pl-10! font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-75"
          />
          {showVenueDropdown && venueResults.length > 0 && (
            <div className="absolute top-14 left-0 right-0 bg-surface border border-border rounded-xl shadow-lg z-30 flex flex-col overflow-hidden max-h-60 overflow-y-auto">
              <div className="px-3 py-2 bg-page/50 border-b border-border text-[0.65rem] font-bold uppercase tracking-widest text-muted">
                Known Venues
              </div>
              {venueResults.map((v) => (
                <button
                  key={v.id}
                  onClick={() => handleSelectVenue(v)}
                  className="flex flex-col px-4 py-3 hover:bg-subtle active:bg-border transition-colors text-left border-b border-border/50 last:border-0"
                >
                  <span className="font-semibold text-main text-[0.95rem] truncate">{v.name}</span>
                  <span className="text-[0.75rem] text-muted mt-0.5">
                    {v.tax_presets ? v.tax_presets.length : 0} Tax Rules •{' '}
                    {v.service_charge_rate > 0 ? v.service_charge_rate * 100 + '% SC' : 'No SC'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. THE ISOLATED MAGIC SCANNER COMPONENT */}
      <MagicScanner />

      {/* 3. SERVICE CHARGE SECTION */}
      <SectionHeader
        title="Service Charge"
        helpText="This is a global fee applied across the entire bill. Set the rate here, and then enable it on a per-item basis in Step 2."
      />
      <div className="bg-surface border-y border-border px-4 py-2 flex flex-col">
        <label className="flex items-center justify-between py-3 cursor-pointer">
          <span className="text-[0.95rem] font-medium text-main">Enable Service Charge</span>
          {isHost ? (
            <ToggleSwitch
              checked={sessionRules.isScApplicable}
              onChange={(val) =>
                actions.updateSessionRulesInDB({
                  isScApplicable: val,
                  ...(!val ? { serviceChargeRate: 0, scTaxPresetId: 'none' } : {}),
                })
              }
            />
          ) : (
            <span className="text-sm font-bold text-muted">
              {sessionRules.isScApplicable ? 'ON' : 'OFF'}
            </span>
          )}
        </label>
        {sessionRules.isScApplicable && (
          <div className="flex flex-col gap-4 py-4 border-t border-border mt-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted uppercase">Rate (%)</label>
              {isHost ? (
                <input
                  type="number"
                  value={
                    sessionRules.serviceChargeRate > 0 ? sessionRules.serviceChargeRate * 100 : ''
                  }
                  placeholder="0"
                  min="0"
                  step="0.1"
                  onChange={(e) =>
                    actions.updateSessionRulesInDB({
                      serviceChargeRate: (parseFloat(e.target.value) || 0) / 100,
                    })
                  }
                  className="w-full h-10 px-3 bg-page border border-border rounded-lg text-[0.95rem] font-medium"
                />
              ) : (
                <div className="w-full h-10 px-3 bg-page border border-border rounded-lg text-[0.95rem] font-medium flex items-center">
                  {sessionRules.serviceChargeRate * 100}%
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted uppercase">How is S.C. Taxed?</label>
              {isHost ? (
                <div className="flex flex-col gap-2">
                  <div className="relative">
                    <select
                      className="w-full h-10 pl-3 pr-8 appearance-none bg-page border border-border rounded-lg text-[0.95rem] font-medium"
                      value={
                        sessionRules.scTaxPresetId === 'inherit' ||
                        sessionRules.scTaxPresetId === 'none'
                          ? sessionRules.scTaxPresetId
                          : 'global'
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'inherit' || val === 'none')
                          actions.updateSessionRulesInDB({ scTaxPresetId: val });
                        else
                          actions.updateSessionRulesInDB({
                            scTaxPresetId: taxPresets[0]?.id || 'none',
                          });
                      }}
                    >
                      <option value="inherit">Inherit Item's Tax</option>
                      <option value="global">Custom Global Tax</option>
                      <option value="none">Not Taxed</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-muted">
                      <ChevronDown size={16} />
                    </div>
                  </div>
                  {sessionRules.scTaxPresetId !== 'inherit' &&
                    sessionRules.scTaxPresetId !== 'none' && (
                      <div className="relative mt-1">
                        <select
                          className="w-full h-10 pl-3 pr-8 appearance-none bg-subtle border border-primary/30 rounded-lg text-[0.95rem] font-medium text-primary"
                          value={sessionRules.scTaxPresetId}
                          onChange={(e) =>
                            actions.updateSessionRulesInDB({ scTaxPresetId: e.target.value })
                          }
                        >
                          {taxPresets.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.rate}%)
                            </option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-primary">
                          <ChevronDown size={16} />
                        </div>
                      </div>
                    )}
                </div>
              ) : (
                <div className="h-10 px-3 bg-page border border-border rounded-lg text-[0.95rem] font-medium flex items-center">
                  {sessionRules.scTaxPresetId === 'inherit'
                    ? 'Inherits Item Tax'
                    : sessionRules.scTaxPresetId === 'none'
                      ? 'Not Taxed'
                      : taxPresets.find((t) => t.id === sessionRules.scTaxPresetId)?.name ||
                        'Custom'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. DISCOUNT SECTION */}
      <SectionHeader
        title="Discount"
        helpText="Specify if the restaurant's discount was subtracted before taxes were calculated (Pre-Tax) or taken off the final grand total (Post-Tax)."
      />
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
                  className="w-full h-10 bg-page border border-border rounded-lg text-[0.95rem] font-medium"
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

      {/* 5. MANUAL TAX SETUP */}
      {isHost && (
        <>
          <SectionHeader
            title="Manual Tax Setup"
            helpText="Create specific tax brackets (like 5% GST or 20% VAT) so you can accurately assign them to individual items in the next step."
          />
          <div className="bg-surface border-y border-border px-4 py-4 flex flex-col gap-4">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 sm:col-span-7 flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted uppercase">Name</label>
                <input
                  type="text"
                  value={newTaxName}
                  onChange={(e) => setNewTaxName(e.target.value)}
                  placeholder="e.g. GST"
                  className="w-full h-10 px-3 bg-page border border-border rounded-lg text-[0.95rem] font-medium"
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
                  className="w-full h-10 px-3 text-center bg-page border border-border rounded-lg text-[0.95rem] font-medium"
                />
              </div>
              <div className="col-span-5 sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-bold opacity-0 select-none hidden sm:block">
                  Split
                </label>
                <div className="flex-1 flex items-center justify-center sm:justify-start">
                  <label className="flex items-center gap-2 cursor-pointer w-full justify-center">
                    <div className="scale-90">
                      <ToggleSwitch checked={newTaxSplit} onChange={setNewTaxSplit} />
                    </div>
                    <span className="text-xs font-bold text-muted uppercase">Split</span>
                  </label>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="h-10 w-full bg-primary active:bg-primary-hover text-white rounded-lg font-medium text-sm shadow-sm mt-1"
              onClick={handleAddTaxPreset}
            >
              Add Preset
            </button>
          </div>
        </>
      )}

      {/* ACTIVE PRESETS */}
      <SectionHeader title={`Active Presets (${taxPresets.length})`} />
      <div className="bg-surface border-y border-border divide-y divide-border pb-6">
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
    </div>
  );
}
