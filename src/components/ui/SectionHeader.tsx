import { useState } from 'react';
import { Info } from 'lucide-react';
import HelpTip from './HelpTip';

interface Props {
  title: string;
  helpText?: string;
}

export default function SectionHeader({ title, helpText }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col px-4 py-3 mt-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-muted uppercase tracking-widest">{title}</h3>
        {helpText && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`p-1 rounded-full transition-colors ${isOpen ? 'text-primary bg-primary/10' : 'text-muted hover:text-primary active:bg-primary/5'}`}
          >
            <Info size={16} />
          </button>
        )}
      </div>
      {helpText && isOpen && (
        <div className="mt-3">
          <HelpTip text={helpText} />
        </div>
      )}
    </div>
  );
}
