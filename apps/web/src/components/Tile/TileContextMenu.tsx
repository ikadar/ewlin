import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Eye, Square, CheckSquare, ChevronUp, ChevronDown, Undo2, Scissors, Merge } from 'lucide-react';

export interface TileContextMenuProps {
  /** Menu position X coordinate (from cursor) */
  x: number;
  /** Menu position Y coordinate (from cursor) */
  y: number;
  /** Whether tile is currently completed */
  isCompleted: boolean;
  /** Whether swap up is available (has tile above) */
  canSwapUp: boolean;
  /** Whether swap down is available (has tile below) */
  canSwapDown: boolean;
  /** Callback for "View details" action */
  onViewDetails: () => void;
  /** Callback for "Toggle completion" action */
  onToggleComplete: () => void;
  /** Callback for "Move up" action */
  onSwapUp: () => void;
  /** Callback for "Move down" action */
  onSwapDown: () => void;
  /** Callback for "Recall" action (unassign) */
  onRecall: () => void;
  /** Whether split is available (runMinutes >= 30 && !completed) */
  canSplit?: boolean;
  /** Whether merge is available (tile is part of a split group) */
  canMerge?: boolean;
  /** Callback for "Diviser" action */
  onSplit?: () => void;
  /** Callback for "Fusionner" action */
  onMerge?: () => void;
  /** Callback to close the menu */
  onClose: () => void;
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
}

function MenuItem({ icon, label, onClick, disabled = false, testId }: MenuItemProps) {
  return (
    <button
      className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors ${
        disabled
          ? 'text-zinc-500 cursor-not-allowed'
          : 'text-zinc-200 hover:bg-zinc-700 cursor-pointer'
      }`}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      disabled={disabled}
      data-testid={testId}
    >
      <span className="w-4 h-4 flex items-center justify-center">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function Separator() {
  return <div className="h-px bg-zinc-700 my-1" />;
}

/**
 * TileContextMenu - Portal-based right-click context menu for tiles
 *
 * Features:
 * - Positioned at cursor location
 * - Auto-flips near viewport edges
 * - Closes on click outside, ESC, or scroll
 * - French labels
 *
 * @since v0.3.58
 */
export function TileContextMenu({
  x,
  y,
  isCompleted,
  canSwapUp,
  canSwapDown,
  onViewDetails,
  onToggleComplete,
  onSwapUp,
  onSwapDown,
  onRecall,
  canSplit = false,
  canMerge = false,
  onSplit,
  onMerge,
  onClose,
}: TileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Calculate position with viewport edge detection
  const getPosition = useCallback(() => {
    const menuWidth = 200;
    const menuHeight = 240; // Approximate height (includes split/merge items)
    const padding = 8;

    let posX = x;
    let posY = y;

    // Flip horizontally if near right edge
    if (x + menuWidth + padding > window.innerWidth) {
      posX = x - menuWidth;
    }

    // Flip vertically if near bottom edge
    if (y + menuHeight + padding > window.innerHeight) {
      posY = y - menuHeight;
    }

    // Ensure not off-screen
    posX = Math.max(padding, posX);
    posY = Math.max(padding, posY);

    return { left: posX, top: posY };
  }, [x, y]);

  const position = getPosition();

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay to prevent immediate close from the right-click event
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Handle scroll (close menu as position would be stale)
  useEffect(() => {
    const handleScroll = () => {
      onClose();
    };

    // Use capture to catch scroll events on any element
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', handleScroll, { capture: true });
  }, [onClose]);

  // Action handlers that close the menu after action
  const handleViewDetails = () => {
    onViewDetails();
    onClose();
  };

  const handleToggleComplete = () => {
    onToggleComplete();
    onClose();
  };

  const handleSwapUp = () => {
    if (canSwapUp) {
      onSwapUp();
      onClose();
    }
  };

  const handleSwapDown = () => {
    if (canSwapDown) {
      onSwapDown();
      onClose();
    }
  };

  const handleRecall = () => {
    if (!isCompleted) {
      onRecall();
      onClose();
    }
  };

  const handleSplit = () => {
    if (canSplit) {
      onSplit?.();
      // Don't close — split popover opens instead
    }
  };

  const handleMerge = () => {
    if (canMerge) {
      onMerge?.();
      onClose();
    }
  };

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-zinc-800 rounded-lg shadow-xl border border-zinc-700 py-1 min-w-[180px]"
      style={{ left: position.left, top: position.top }}
      data-testid="tile-context-menu"
      role="menu"
    >
      <MenuItem
        icon={<Eye className="w-4 h-4" />}
        label="Voir détails"
        onClick={handleViewDetails}
        testId="context-menu-view-details"
      />
      <MenuItem
        icon={isCompleted ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
        label={isCompleted ? 'Marquer non terminé' : 'Marquer terminé'}
        onClick={handleToggleComplete}
        testId="context-menu-toggle-complete"
      />
      <MenuItem
        icon={<Undo2 className="w-4 h-4" />}
        label="Rappeler (désassigner)"
        onClick={handleRecall}
        disabled={isCompleted}
        testId="context-menu-recall"
      />
      <MenuItem
        icon={<Scissors className="w-4 h-4" />}
        label="Diviser"
        onClick={handleSplit}
        disabled={!canSplit}
        testId="context-menu-split"
      />
      {canMerge && (
        <MenuItem
          icon={<Merge className="w-4 h-4" />}
          label="Fusionner"
          onClick={handleMerge}
          testId="context-menu-merge"
        />
      )}
      <Separator />
      <MenuItem
        icon={<ChevronUp className="w-4 h-4" />}
        label="Déplacer vers le haut"
        onClick={handleSwapUp}
        disabled={!canSwapUp}
        testId="context-menu-move-up"
      />
      <MenuItem
        icon={<ChevronDown className="w-4 h-4" />}
        label="Déplacer vers le bas"
        onClick={handleSwapDown}
        disabled={!canSwapDown}
        testId="context-menu-move-down"
      />
    </div>,
    document.body
  );
}
