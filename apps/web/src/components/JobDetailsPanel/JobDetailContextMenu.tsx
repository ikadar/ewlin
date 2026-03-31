import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Square, CheckSquare, Undo2, Scissors, Merge, Pin } from 'lucide-react';

export interface JobDetailContextMenuProps {
  x: number;
  y: number;
  isCompleted: boolean;
  isPinned: boolean;
  onTogglePin: () => void;
  onToggleComplete: () => void;
  onRecall: () => void;
  onSplit?: () => void;
  onFuse?: () => void;
  isSplit?: boolean;
  /** Whether this is an unassigned task (hides recall/completion) */
  isUnassigned?: boolean;
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

export function JobDetailContextMenu({
  x,
  y,
  isCompleted,
  isPinned,
  onTogglePin,
  onToggleComplete,
  onRecall,
  onSplit,
  onFuse,
  isSplit = false,
  isUnassigned = false,
  onClose,
}: JobDetailContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const getPosition = useCallback(() => {
    const menuWidth = 200;
    const menuHeight = 80;
    const padding = 8;

    let posX = x;
    let posY = y;

    if (x + menuWidth + padding > window.innerWidth) {
      posX = x - menuWidth;
    }
    if (y + menuHeight + padding > window.innerHeight) {
      posY = y - menuHeight;
    }

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

  // Handle scroll
  useEffect(() => {
    const handleScroll = () => {
      onClose();
    };

    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', handleScroll, { capture: true });
  }, [onClose]);

  const handleToggleComplete = () => {
    onToggleComplete();
    onClose();
  };

  const handleTogglePin = () => {
    onTogglePin();
    onClose();
  };

  const handleRecall = () => {
    if (!isCompleted && !isPinned) {
      onRecall();
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

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-zinc-800 rounded-lg shadow-xl border border-zinc-700 py-1 min-w-[180px]"
      style={{ left: position.left, top: position.top }}
      data-testid="job-detail-context-menu"
      role="menu"
    >
      {!isUnassigned && (
        <>
          <MenuItem
            icon={isCompleted ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            label={isCompleted ? 'Marquer à faire' : 'Marquer terminée'}
            onClick={handleToggleComplete}
            testId="job-detail-context-toggle-complete"
          />
          <MenuItem
            icon={<Pin className="w-4 h-4" />}
            label={isPinned ? 'Désépingler' : 'Épingler'}
            onClick={handleTogglePin}
            testId="job-detail-context-toggle-pin"
          />
          <MenuItem
            icon={<Undo2 className="w-4 h-4" />}
            label="Rappeler (désassigner)"
            onClick={handleRecall}
            disabled={isCompleted || isPinned}
            testId="job-detail-context-recall"
          />
        </>
      )}
      {onSplit && !isCompleted && (
        <MenuItem
          icon={<Scissors className="w-4 h-4" />}
          label={isSplit ? 'Diviser encore' : 'Diviser'}
          onClick={handleSplit}
          testId="job-detail-context-split"
        />
      )}
      {isSplit && onFuse && (
        <MenuItem
          icon={<Merge className="w-4 h-4" />}
          label="Fusionner"
          onClick={handleFuse}
          testId="job-detail-context-fuse"
        />
      )}
    </div>,
    document.body
  );
}
