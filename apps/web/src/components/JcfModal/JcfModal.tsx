import { useEffect, useRef, useCallback } from 'react';
import { X, Save } from 'lucide-react';

export interface JcfModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Modal title */
  title?: string;
  /** Modal content (children) */
  children?: React.ReactNode;
  /** Handler for "Save as Template" button (v0.4.34) */
  onSaveAsTemplate?: () => void;
  /** Disable Save as Template button (e.g., when no elements) */
  canSaveAsTemplate?: boolean;
  /** Save handler - called when Save button is clicked */
  onSave?: () => void;
  /** Whether save is in progress (disables button) */
  isSaving?: boolean;
  /** v0.4.33: Error message to display (from API failure) */
  error?: string | null;
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
  onSaveAsTemplate,
  canSaveAsTemplate = true,
  onSave,
  isSaving = false,
  error = null,
}: JcfModalProps) {
  const mouseDownTargetRef = useRef<EventTarget | null>(null);

  const stableOnClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const stableOnSave = useCallback(() => {
    onSave?.();
  }, [onSave]);

  // Escape key closes modal; Cmd+S / Ctrl+S triggers save
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        stableOnSave();
        return;
      }

      if (e.key === 'Escape' && !e.defaultPrevented) {
        stableOnClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, stableOnClose, stableOnSave]);

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
      role="presentation"
      data-testid="jcf-modal-backdrop"
    >
      <div
        className="w-[70vw] max-w-[1400px] max-h-[90vh] bg-zinc-950 rounded-[7px] border border-zinc-800 flex flex-col overflow-hidden text-base leading-[1.4]"
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
          {/* v0.4.33: Error message display */}
          {error && (
            <div
              className="px-[13px] py-[8px] bg-red-950/50 border-b border-red-900/50 text-red-400 text-sm whitespace-pre-wrap"
              data-testid="jcf-modal-error"
            >
              {error}
            </div>
          )}
          {/* Keyboard hints row */}
          <div className="px-[13px] py-[5px] border-b border-zinc-800/50 flex items-center gap-[13px] text-sm text-zinc-500">
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
          {/* Action buttons row */}
          <div className="px-[13px] py-[8px] flex items-center justify-end gap-[10px]">
            {onSaveAsTemplate && (
              <button
                onClick={onSaveAsTemplate}
                disabled={!canSaveAsTemplate}
                className="flex items-center gap-[5px] px-[10px] py-[5px] text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-[3px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="jcf-save-as-template"
              >
                <Save size={14} />
                <span className="text-sm">Sauvegarder comme template</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-[13px] py-[6px] text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-[5px] font-medium transition-colors"
              data-testid="jcf-modal-cancel"
            >
              Annuler
            </button>
            {onSave && (
              <button
                onClick={stableOnSave}
                disabled={isSaving}
                className="px-[13px] py-[6px] text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white rounded-[5px] font-medium transition-colors flex items-center gap-[6px]"
                data-testid="jcf-modal-save"
              >
                <Save size={14} />
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
