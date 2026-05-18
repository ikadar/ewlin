import { useState, useEffect, type ReactElement } from 'react';

export interface MobileHeaderProps {
  name: string;
  modeLabel: string;
}

function useClockMinute(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function MobileHeader({ name, modeLabel }: MobileHeaderProps): ReactElement {
  const clock = useClockMinute();

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 border-b border-flux-border bg-zinc-950 flex-shrink-0"
      style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-flux-text-primary truncate">{name}</div>
        <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-zinc-500">{modeLabel}</div>
      </div>
      <div className="text-[13px] font-medium text-zinc-400 tabular-nums flex-shrink-0">{clock}</div>
    </div>
  );
}
