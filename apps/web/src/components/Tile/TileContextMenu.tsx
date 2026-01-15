/**
 * TileContextMenu - Context menu for tile actions
 *
 * v0.3.63: Replaces visible buttons (eye, swap arrows) with right-click menu.
 * Optimized for power users who spend 5h+/day on the tool.
 *
 * Actions:
 * - View details: Opens job details panel
 * - Mark as done/incomplete: Toggles completion status
 * - Move up/down: Swaps position with adjacent tile
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Eye, Square, CheckSquare, ChevronUp, ChevronDown } from 'lucide-react';

export interface TileContextMenuProps {
  /** Position where the menu should appear */
  position: { x: number; y: number };
  /** Callback to close the menu */
  onClose: () => void;
  /** Callback when "View details" is clicked */
  onViewDetails: () => void;
  /** Callback when "Mark complete/incomplete" is clicked */
  onToggleComplete: () => void;
  /** Callback when "Move up" is clicked */
  onMoveUp: () => void;
  /** Callback when "Move down" is clicked */
  onMoveDown: () => void;
  /** Current completion status */
  isCompleted: boolean;
  /** Whether to show the "Move up" option */
  showMoveUp: boolean;
  /** Whether to show the "Move down" option */
  showMoveDown: boolean;
}

interface MenuItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}

/**
 * Calculate menu position to keep it within viewport bounds.
 */
function calculatePosition(
  clickX: number,
  clickY: number,
  menuWidth: number,
  menuHeight: number
): { x: number; y: number } {
  const padding = 8;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Default: appear at cursor
  let x = clickX;
  let y = clickY;

  // Flip horizontal if too close to right edge
  if (x + menuWidth + padding > viewportWidth) {
    x = clickX - menuWidth;
  }

  // Flip vertical if too close to bottom edge
  if (y + menuHeight + padding > viewportHeight) {
    y = clickY - menuHeight;
  }

  // Clamp to viewport
  x = Math.max(padding, Math.min(x, viewportWidth - menuWidth - padding));
  y = Math.max(padding, Math.min(y, viewportHeight - menuHeight - padding));

  return { x, y };
}

/**
 * MenuItem - Individual menu item with icon and label.
 */
function MenuItem({ icon: Icon, label, onClick }: MenuItemProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };

  return (
    <button
      type="button"
      className="w-full px-3 py-1.5 flex items-center gap-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors text-left cursor-pointer"
      onClick={handleClick}
    >
      <Icon className="w-4 h-4 text-zinc-400" />
      {label}
    </button>
  );
}

/**
 * TileContextMenu - Right-click context menu for tile actions.
 */
export function TileContextMenu({
  position,
  onClose,
  onViewDetails,
  onToggleComplete,
  onMoveUp,
  onMoveDown,
  isCompleted,
  showMoveUp,
  showMoveDown,
}: TileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // Calculate adjusted position once menu is rendered
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const newPosition = calculatePosition(
        position.x,
        position.y,
        rect.width,
        rect.height
      );
      setAdjustedPosition(newPosition);
    }
  }, [position]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use setTimeout to avoid immediately closing on the same click that opened it
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Close on scroll (menu position would be stale)
  useEffect(() => {
    const handleScroll = () => onClose();
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [onClose]);

  // Wrap action handlers to close menu after action
  const handleViewDetails = useCallback(() => {
    onViewDetails();
    onClose();
  }, [onViewDetails, onClose]);

  const handleToggleComplete = useCallback(() => {
    onToggleComplete();
    onClose();
  }, [onToggleComplete, onClose]);

  const handleMoveUp = useCallback(() => {
    onMoveUp();
    onClose();
  }, [onMoveUp, onClose]);

  const handleMoveDown = useCallback(() => {
    onMoveDown();
    onClose();
  }, [onMoveDown, onClose]);

  const showMoveActions = showMoveUp || showMoveDown;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[160px]"
      style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
      data-testid="tile-context-menu"
    >
      <MenuItem
        icon={Eye}
        label="Voir détails"
        onClick={handleViewDetails}
      />
      <MenuItem
        icon={isCompleted ? CheckSquare : Square}
        label={isCompleted ? 'Marquer non terminé' : 'Marquer terminé'}
        onClick={handleToggleComplete}
      />
      {showMoveActions && (
        <>
          <div className="h-px bg-zinc-700 my-1" />
          {showMoveUp && (
            <MenuItem
              icon={ChevronUp}
              label="Déplacer vers le haut"
              onClick={handleMoveUp}
            />
          )}
          {showMoveDown && (
            <MenuItem
              icon={ChevronDown}
              label="Déplacer vers le bas"
              onClick={handleMoveDown}
            />
          )}
        </>
      )}
    </div>,
    document.body
  );
}
