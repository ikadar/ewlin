import type { ReactNode } from 'react';

interface Props {
  title: string;
  description?: string;
  legend?: ReactNode;
  fullWidth?: boolean;
  children: ReactNode;
}

export function ChartCard({ title, description, legend, fullWidth, children }: Props) {
  return (
    <div
      className={`bg-white/[0.02] border border-flux-border rounded-[10px] overflow-hidden ${fullWidth ? 'col-span-2' : ''}`}
    >
      <div className="px-4 pt-3.5 flex items-baseline gap-2">
        <h2 className="text-[13px] font-semibold text-flux-text-primary">{title}</h2>
        {description && (
          <span className="text-[11px] text-flux-text-muted">{description}</span>
        )}
      </div>
      {legend && <div className="flex gap-4 px-4 pt-1.5 flex-wrap">{legend}</div>}
      <div className="px-2 pb-3 pt-2">{children}</div>
    </div>
  );
}
