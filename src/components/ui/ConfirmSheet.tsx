import { useState, useEffect } from 'react';
import BottomSheet from './BottomSheet';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { utils } from '../../lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary' | 'success';
  requireMatchText?: string;
}

export default function ConfirmSheet({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  requireMatchText,
}: Props) {
  const [typedText, setTypedText] = useState('');

  useEffect(() => {
    if (!isOpen) setTypedText('');
  }, [isOpen]);

  const isMatchValid = !requireMatchText || typedText.trim() === requireMatchText;

  const btnClasses =
    variant === 'danger'
      ? 'bg-danger hover:bg-danger/90 text-white'
      : variant === 'success'
        ? 'bg-success hover:bg-success-dark text-white'
        : 'bg-primary hover:bg-primary-hover text-white';

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col gap-5 pb-2">
        <div className="flex items-start gap-3.5">
          <div
            className={`p-2.5 rounded-2xl shrink-0 ${
              variant === 'danger'
                ? 'bg-danger/10 text-danger'
                : variant === 'success'
                  ? 'bg-success/10 text-success'
                  : 'bg-primary/10 text-primary'
            }`}
          >
            {variant === 'danger' ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}
          </div>
          <p className="text-sm text-muted font-medium leading-relaxed pt-0.5">{description}</p>
        </div>

        {requireMatchText && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-muted">
              Type <span className="text-danger font-mono">{requireMatchText}</span> to confirm
            </label>
            <input
              type="text"
              autoFocus
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder={requireMatchText}
              className="w-full h-11 bg-page border border-border rounded-xl px-3 font-mono font-bold text-main"
            />
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 bg-page hover:bg-subtle text-main border border-border rounded-xl font-bold text-sm transition-transform active:scale-95"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={!isMatchValid}
            onClick={() => {
              utils.haptic('medium');
              onConfirm();
              onClose();
            }}
            className={`flex-1 h-12 rounded-xl font-bold text-sm transition-transform active:scale-95 disabled:opacity-40 shadow-sm ${btnClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
