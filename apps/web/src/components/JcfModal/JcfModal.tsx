import { useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';

export interface JcfModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Modal title */
  title?: string;
  /** Modal content (children) */
  children?: React.ReactNode;
}

/**
 * JCF full-screen modal overlay.
 * Contains a header with title + close button, scrollable content area,
 * and a footer with keyboard hints.
 */
export function JcfModal({
  isOpen,
  onClose,
  title = 'Nouveau Job',
  children,
}: JcfModalProps) {
  const mouseDownTargetRef = useRef<EventTarget | null>(null);

  const stableOnClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Escape key closes modal; Cmd+S / Ctrl+S reserved (no-op for now)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        return;
      }

      if (e.key === 'Escape' && !e.defaultPrevented) {
        stableOnClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, stableOnClose]);

  if (!isOpen) return null;

  // Track where mousedown started for backdrop click
  const handleMouseDown = (e: React.MouseEvent) => {
    mouseDownTargetRef.current = e.target;
  };

  // Only close if both mousedown AND mouseup were on the backdrop
  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && mouseDownTargetRef.current === e.currentTarget) {
      onClose();
    }
    mouseDownTargetRef.current = null;
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      data-testid="jcf-modal-backdrop"
    >
      <div
        className="w-[70vw] max-w-[1400px] max-h-[90vh] bg-zinc-950 rounded-[7px] border border-zinc-800 flex flex-col overflow-hidden text-[13px] leading-[1.4]"
        data-testid="jcf-modal-dialog"
      >
        {/* Header */}
        <header className="flex-shrink-0 flex items-center justify-between px-[13px] py-[10px] bg-zinc-900 border-b border-zinc-800">
          <h1 className="text-[15px] leading-[23px] font-medium text-zinc-100" data-testid="jcf-modal-title">
            {title}
          </h1>
          <button
            onClick={onClose}
            className="p-[3px] rounded-[3px] hover:bg-zinc-800 transition-colors"
            aria-label="Fermer"
            data-testid="jcf-modal-close"
          >
            <X size={20} className="text-zinc-400 hover:text-zinc-100" />
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-[20px] py-[13px]" data-testid="jcf-modal-content">
          {children || (
            <div className="space-y-[13px]">
              <p className="text-zinc-400">Contenu du formulaire job...</p>
              {Array.from({ length: 20 }, (_, i) => (
                <div key={i} className="p-[13px] bg-zinc-800 rounded-[3px] border border-zinc-700">
                  <p className="text-zinc-300">Section {i + 1}</p>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="flex-shrink-0 bg-zinc-900 border-t border-zinc-800" data-testid="jcf-modal-footer">
          {/* Keyboard hints row */}
          <div className="px-[13px] py-[5px] border-b border-zinc-800/50 flex items-center gap-[13px] text-[11px] text-zinc-500">
            <span className="flex items-center gap-[3px]">
              <kbd className="bg-zinc-800 px-[5px] py-[2px] rounded-[3px] text-zinc-400">Tab</kbd> Champ suivant
            </span>
            <span className="flex items-center gap-[3px]">
              <kbd className="bg-zinc-800 px-[3px] py-[2px] rounded-[3px] text-zinc-400">⌥</kbd>
              <kbd className="bg-zinc-800 px-[3px] py-[2px] rounded-[3px] text-zinc-400">←↑↓→</kbd> Naviguer tableau
            </span>
            <span className="flex items-center gap-[3px]">
              <kbd className="bg-zinc-800 px-[3px] py-[2px] rounded-[3px] text-zinc-400">↑↓</kbd> Liste
            </span>
            <span className="flex items-center gap-[3px]">
              <kbd className="bg-zinc-800 px-[5px] py-[2px] rounded-[3px] text-zinc-400">⌘S</kbd> Sauvegarder
            </span>
            <span className="flex items-center gap-[3px]">
              <kbd className="bg-zinc-800 px-[5px] py-[2px] rounded-[3px] text-zinc-400">Esc</kbd> Fermer
            </span>
          </div>
          {/* Action buttons row (placeholder for future save buttons) */}
          <div className="px-[13px] py-[8px] flex items-center justify-end">
            <span className="text-[10px] leading-[13px] text-zinc-600">Actions disponibles dans une version ultérieure</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
