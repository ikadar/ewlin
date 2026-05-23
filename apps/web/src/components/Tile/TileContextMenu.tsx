import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Eye, Square, CheckSquare, Undo2, Scissors, Merge, Pin, Clock, CalendarDays } from 'lucide-react';

export interface TileContextMenuProps {
  /** Menu position X coordinate (from cursor) */
  x: number;
  /** Menu position Y coordinate (from cursor) */
  y: number;
  /** Whether tile is currently completed */
  isCompleted: boolean;
  /** Whether tile is currently pinned */
  isPinned: boolean;
  /**
   * Scenario mode. Drives the prod/préprod separation:
   * - prod   → reality-capture actions only (saisie, marquer terminé)
   * - préprod → planning actions only (pin, définir, rappel, diviser, fusionner)
   * "Voir détails" is navigation and shows in both.
   */
  scenarioMode: 'prod' | 'preprod';
  /** Callback for "Toggle pin" action (préprod-only). */
  onTogglePin?: () => void;
  /** Callback for "View details" action (both modes). */
  onViewDetails?: () => void;
  /** Callback for "Toggle completion" action (prod-only). */
  onToggleComplete?: () => void;
  /** Callback for "Recall" (unassign) action (préprod-only). */
  onRecall?: () => void;
  /** Callback for "Split" action (préprod-only). */
  onSplit?: () => void;
  /** Callback for "Fuse" action (préprod-only). */
  onFuse?: () => void;
  /** Whether this task is part of a split group */
  isSplit?: boolean;
  /** Callback for "Saisir l'avancement" (prod-only, past-started callers). */
  onSaisirAvancement?: () => void;
  /** Callback for "Définir heure de début…" (préprod-only, future-start callers). */
  onDefinirDebut?: () => void;
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
  isPinned,
  scenarioMode,
  onTogglePin,
  onViewDetails,
  onToggleComplete,
  onRecall,
  onSplit,
  onFuse,
  isSplit = false,
  onSaisirAvancement,
  onDefinirDebut,
  onClose,
}: TileContextMenuProps) {
  const isProd = scenarioMode === 'prod';

  const showVoirDetails = !!onViewDetails;
  const showSaisir = !!onSaisirAvancement && isProd;
  const showTerminer = !!onToggleComplete && isProd;
  const showPin = !!onTogglePin && !isProd;
  const showDefinir = !!onDefinirDebut && !isProd;
  const showRecall = !!onRecall && !isProd;
  const showSplit = !!onSplit && !isProd && !isCompleted;
  const showFuse = !!onFuse && !isProd && isSplit;
  const showSeparator = (showSplit || showFuse) && (showVoirDetails || showSaisir || showTerminer || showPin || showDefinir || showRecall);
  const menuRef = useRef<HTMLDivElement>(null);

  // Calculate position with viewport edge detection
  const getPosition = useCallback(() => {
    const menuWidth = 200;
    const menuHeight = 180; // Approximate height
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
    onViewDetails?.();
    onClose();
  };

  const handleToggleComplete = () => {
    onToggleComplete?.();
    onClose();
  };

  const handleTogglePin = () => {
    onTogglePin?.();
    onClose();
  };

  const handleRecall = () => {
    if (!isCompleted && !isPinned) {
      onRecall?.();
      onClose();
    }
  };

  const handleSplit = () => {
    onSplit?.();
    onClose();
  };

  const handleFuse = () => {
    onFuse?.();
    onClose();
  };

  const handleSaisirAvancement = () => {
    onSaisirAvancement?.();
    onClose();
  };

  const handleDefinirDebut = () => {
    onDefinirDebut?.();
    onClose();
  };

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-zinc-800 rounded-lg shadow-xl border border-zinc-700 py-1 min-w-[180px]"
      style={{ left: position.left, top: position.top }}
      data-testid="tile-context-menu"
      role="menu"
    >
      {showVoirDetails && (
        <MenuItem
          icon={<Eye className="w-4 h-4" />}
          label="Voir détails"
          onClick={handleViewDetails}
          testId="context-menu-view-details"
        />
      )}
      {showSaisir && (
        <MenuItem
          icon={<Clock className="w-4 h-4" />}
          label="Saisir l'avancement"
          onClick={handleSaisirAvancement}
          testId="context-menu-saisir-avancement"
        />
      )}
      {showTerminer && (
        <MenuItem
          icon={isCompleted ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          label={isCompleted ? 'Marquer non terminé' : 'Marquer terminé'}
          onClick={handleToggleComplete}
          testId="context-menu-toggle-complete"
        />
      )}
      {showPin && (
        <MenuItem
          icon={<Pin className="w-4 h-4" />}
          label={isPinned ? 'Désépingler' : 'Épingler'}
          onClick={handleTogglePin}
          testId="context-menu-toggle-pin"
        />
      )}
      {showDefinir && (
        <MenuItem
          icon={<CalendarDays className="w-4 h-4" />}
          label="Définir heure de début…"
          onClick={handleDefinirDebut}
          testId="context-menu-definir-debut"
        />
      )}
      {showRecall && (
        <MenuItem
          icon={<Undo2 className="w-4 h-4" />}
          label="Rappeler (désassigner)"
          onClick={handleRecall}
          disabled={isCompleted || isPinned}
          testId="context-menu-recall"
        />
      )}
      {showSeparator && <Separator />}
      {showSplit && (
        <MenuItem
          icon={<Scissors className="w-4 h-4" />}
          label={isSplit ? 'Diviser encore' : 'Diviser'}
          onClick={handleSplit}
          testId="context-menu-split"
        />
      )}
      {showFuse && (
        <MenuItem
          icon={<Merge className="w-4 h-4" />}
          label="Fusionner"
          onClick={handleFuse}
          testId="context-menu-fuse"
        />
      )}
    </div>,
    document.body
  );
}
