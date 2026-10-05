import { Info } from 'lucide-react';

interface Props {
  title?: string;
  text: string;
}

export default function HelpTip({ title, text }: Props) {
  return (
    <div className="w-full bg-primary/5 border border-primary/10 rounded-xl p-3.5 flex items-start gap-3 shadow-[0_2px_10px_-4px_rgba(0,128,255,0.1)]">
      <div className="mt-0.5 bg-primary/10 p-1 rounded-md shrink-0 text-primary">
        <Info size={16} strokeWidth={2.5} />
      </div>
      <div className="flex flex-col gap-0.5">
        {title && (
          <span className="text-[0.75rem] font-bold text-primary uppercase tracking-widest">
            {title}
          </span>
        )}
        <p className="text-[0.85rem] text-muted leading-relaxed font-medium">{text}</p>
      </div>
    </div>
  );
}
