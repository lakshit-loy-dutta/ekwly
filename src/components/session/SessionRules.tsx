import type { TaxPreset } from '../../lib/types';
import { ChevronDown, Trash2 } from 'lucide-react';

interface Props {
  isHost: boolean;
  isScApplicable: boolean;
  handleToggleSc: (checked: boolean) => void;
  serviceChargeRate: number;
  setServiceChargeRate: (val: number) => void;
  scTaxPresetId: string;
  setScTaxPresetId: (val: string) => void;
  discountType: 'none' | 'percentage' | 'flat';
  setDiscountType: (val: 'none' | 'percentage' | 'flat') => void;
  discountMode: 'pre-tax' | 'post-tax';
  setDiscountMode: (val: 'pre-tax' | 'post-tax') => void;
  discountValue: string;
  setDiscountValue: (val: string) => void;
  taxPresets: TaxPreset[];
  newTaxName: string;
  setNewTaxName: (val: string) => void;
  newTaxRate: string;
  setNewTaxRate: (val: string) => void;
  newTaxSplit: boolean;
  setNewTaxSplit: (val: boolean) => void;
  handleAddTaxPreset: () => void;
  handleRemoveTaxPreset: (id: string) => void;
}

export default function SessionRules(props: Props) {
  return (
    <div className="w-full flex flex-col">
      {/* SERVICE CHARGE SECTION */}
      <div className="px-4 py-3 mt-2">
        <h3 className="text-xs font-bold text-muted uppercase tracking-widest">Service Charge</h3>
      </div>
      <div className="bg-surface border-y border-border px-4 py-2 flex flex-col">
        <label className="flex items-center justify-between py-3 cursor-pointer">
          <span className="text-[0.95rem] font-medium text-main">Enable Service Charge</span>
          {props.isHost ? (
            <div className="toggle-switch">
              <input
                type="checkbox"
                checked={props.isScApplicable}
                onChange={(e) => props.handleToggleSc(e.target.checked)}
              />
              <span className="slider"></span>
            </div>
          ) : (
            <span className="text-sm font-bold text-muted">
              {props.isScApplicable ? 'ON' : 'OFF'}
            </span>
          )}
        </label>

        {props.isScApplicable && (
          <div className="grid grid-cols-2 gap-4 py-4 border-t border-border mt-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted uppercase">Rate (%)</label>
              {props.isHost ? (
                <input
                  type="number"
                  value={props.serviceChargeRate > 0 ? props.serviceChargeRate * 100 : ''}
                  placeholder="0"
                  min="0"
                  step="0.1"
                  onChange={(e) =>
                    props.setServiceChargeRate((parseFloat(e.target.value) || 0) / 100)
                  }
                  className="h-10 px-3 bg-page border border-border rounded-lg text-[0.95rem] font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              ) : (
                <div className="h-10 px-3 bg-page border border-border rounded-lg text-[0.95rem] font-medium flex items-center">
                  {props.serviceChargeRate * 100}%
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted uppercase">Tax on S.C.</label>
              {props.isHost ? (
                <div className="relative">
                  <select
                    className="w-full h-10 pl-3 pr-8 appearance-none bg-page border border-border rounded-lg text-[0.95rem] font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={props.scTaxPresetId}
                    onChange={(e) => props.setScTaxPresetId(e.target.value)}
                  >
                    <option value="none">None</option>
                    {props.taxPresets.map((t) => (
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
                  {props.taxPresets.find((t) => t.id === props.scTaxPresetId)?.name || 'None'}
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
              disabled={!props.isHost}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${props.discountType === type ? 'bg-surface shadow-sm text-main border border-border' : 'text-muted hover:text-main'}`}
              onClick={() => props.setDiscountType(type)}
            >
              {type}
            </button>
          ))}
        </div>

        {props.discountType !== 'none' && (
          <div className="flex flex-col gap-4 pt-2 border-t border-border mt-1">
            <div className="flex items-center gap-1 bg-page p-1 rounded-lg border border-border">
              <button
                disabled={!props.isHost}
                onClick={() => props.setDiscountMode('pre-tax')}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${props.discountMode === 'pre-tax' ? 'bg-surface shadow-sm text-main border border-border' : 'text-muted hover:text-main'}`}
              >
                Pre-Tax
              </button>
              <button
                disabled={!props.isHost}
                onClick={() => props.setDiscountMode('post-tax')}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${props.discountMode === 'post-tax' ? 'bg-surface shadow-sm text-main border border-border' : 'text-muted hover:text-main'}`}
              >
                Post-Tax
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-[0.95rem] font-medium text-main">Discount Value</label>
              <div className="relative w-32">
                {props.discountType === 'flat' && (
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted font-bold text-[0.95rem]">
                    ₹
                  </div>
                )}
                <input
                  type="text"
                  inputMode="decimal"
                  disabled={!props.isHost}
                  value={props.discountValue}
                  onChange={(e) => props.setDiscountValue(e.target.value)}
                  placeholder="0"
                  style={{
                    paddingLeft: props.discountType === 'flat' ? '28px' : '12px',
                    paddingRight: props.discountType === 'percentage' ? '28px' : '12px',
                    textAlign: props.discountType === 'flat' ? 'left' : 'right',
                  }}
                  className="w-full h-10 bg-page border border-border rounded-lg text-[0.95rem] font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-75"
                />
                {props.discountType === 'percentage' && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted font-bold text-[0.95rem]">
                    %
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ADD TAX PRESET SECTION (HIDDEN FOR GUESTS) */}
      {props.isHost && (
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
                  value={props.newTaxName}
                  onChange={(e) => props.setNewTaxName(e.target.value)}
                  placeholder="e.g. GST"
                  className="w-full h-10 px-3 bg-page border border-border rounded-lg text-[0.95rem] font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div className="col-span-7 sm:col-span-3 flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted uppercase">Rate (%)</label>
                <input
                  type="number"
                  value={props.newTaxRate}
                  onChange={(e) => props.setNewTaxRate(e.target.value)}
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
                        checked={props.newTaxSplit}
                        onChange={(e) => props.setNewTaxSplit(e.target.checked)}
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
              onClick={props.handleAddTaxPreset}
            >
              Add Preset
            </button>
          </div>
        </>
      )}

      {/* ACTIVE PRESETS */}
      <div className="px-4 py-3 mt-4">
        <h3 className="text-xs font-bold text-muted uppercase tracking-widest">
          Active Presets ({props.taxPresets.length})
        </h3>
      </div>
      <div className="bg-surface border-y border-border divide-y divide-border">
        {props.taxPresets.map((t) => (
          <div key={t.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-main text-[0.95rem]">{t.name}</span>
              <span className="text-xs font-bold text-muted bg-page px-1.5 py-0.5 rounded border border-border">
                {t.rate}%
              </span>
              {t.split && (
                <span className="text-[0.65rem] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                  Split
                </span>
              )}
            </div>
            {props.isHost && (
              <button
                type="button"
                className="text-muted active:text-danger p-1"
                onClick={() => props.handleRemoveTaxPreset(t.id)}
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
