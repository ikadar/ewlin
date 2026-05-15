import { CircleCheck, Circle } from 'lucide-react';

interface FluxToggleProps {
  active: boolean;
  onToggle?: () => void;
  activeDate?: string | null;
  activeTitle?: string;
  inactiveTitle?: string;
  readOnly?: boolean;
}

function ToggleContent({ active, activeDate }: { active: boolean; activeDate?: string | null }) {
  if (active) {
    return (
      <>
        <CircleCheck className="w-4 h-4 text-emerald-500" strokeWidth={2} />
        {activeDate && (
          <span className="text-flux-text-muted" style={{ fontSize: '11px' }}>
            {activeDate}
          </span>
        )}
      </>
    );
  }
  return <Circle className="w-4 h-4 text-zinc-600" strokeWidth={2} />;
}

export function FluxToggle({
  active,
  onToggle,
  activeDate,
  activeTitle,
  inactiveTitle,
  readOnly,
}: FluxToggleProps) {
  if (readOnly || !onToggle) {
    return (
      <span className="flex items-center gap-1.5">
        <ToggleContent active={active} activeDate={activeDate} />
      </span>
    );
  }
  return (
    <button
      type="button"
      className="flex items-center gap-1.5 cursor-pointer hover:opacity-80"
      onClick={onToggle}
      title={active ? activeTitle : inactiveTitle}
    >
      <ToggleContent active={active} activeDate={activeDate} />
    </button>
  );
}
