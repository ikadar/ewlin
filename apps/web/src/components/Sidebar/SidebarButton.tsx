import type { LucideIcon } from 'lucide-react';

export interface SidebarButtonProps {
  /** Lucide icon component */
  icon: LucideIcon;
  /** Accessible label for the button */
  label: string;
  /** Whether this button is the active view */
  isActive?: boolean;
  /** Whether this button is disabled */
  isDisabled?: boolean;
  /** Click handler */
  onClick?: () => void;
}

/**
 * Navigation button for the Sidebar.
 * Supports active, inactive, hover, and disabled states.
 */
export function SidebarButton({
  icon: Icon,
  label,
  isActive = false,
  isDisabled = false,
  onClick,
}: SidebarButtonProps) {
  const baseClasses =
    'w-10 h-10 flex items-center justify-center rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-zinc-900';

  const stateClasses = isDisabled
    ? 'text-zinc-700 cursor-not-allowed'
    : isActive
      ? 'bg-white/10 text-zinc-300 hover:bg-white/15 hover:text-white'
      : 'text-zinc-500 hover:bg-white/10 hover:text-zinc-300';

  return (
    <button
      type="button"
      className={`${baseClasses} ${stateClasses}`}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}
