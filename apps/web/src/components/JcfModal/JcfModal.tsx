import { useEffect, useCallback, useState } from 'react';
import { X, Save } from 'lucide-react';
import { KBD_CLASS } from '../ShortcutFooter/kbdStyles';

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
  /** v0.5.13b: Custom label for save button (default: "Enregistrer") */
  saveLabel?: string;
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
  saveLabel,
}: JcfModalProps) {
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const stableOnSave = useCallback(() => {
    onSave?.();
  }, [onSave]);

  const requestClose = useCallback(() => {
    setShowCloseConfirm(true);
  }, []);

  const confirmClose = useCallback(() => {
    setShowCloseConfirm(false);
    onClose();
  }, [onClose]);

  const cancelClose = useCallback(() => {
    setShowCloseConfirm(false);
  }, []);

  // Cmd+S / Ctrl+S triggers save, Escape triggers close confirmation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        stableOnSave();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showCloseConfirm) {
          cancelClose();
        } else {
          requestClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, stableOnSave, showCloseConfirm, requestClose, cancelClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      data-testid="jcf-modal-backdrop"
      onClick={requestClose}
    >
      <div
        className="w-[95vw] max-w-[2200px] max-h-[90vh] bg-zinc-950 rounded-[7px] border border-zinc-800 flex flex-col overflow-hidden text-base leading-[1.4]"
        data-testid="jcf-modal-dialog"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex-shrink-0 flex items-center justify-between px-[13px] py-[10px] bg-zinc-900 border-b border-zinc-800">
          <h1 className="text-[15px] leading-[23px] font-medium text-zinc-100" data-testid="jcf-modal-title">
            {title}
          </h1>
          <button
            onClick={requestClose}
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
          <div className="px-[13px] py-[5px] border-b border-zinc-800/50 flex items-center gap-5">
            <span className="flex items-center gap-2">
              <kbd className={KBD_CLASS}>Tab</kbd>
              <span className="text-zinc-500 text-[11px]">Champ suivant</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <kbd className={KBD_CLASS}>⌥</kbd>
                <span className="text-zinc-500 text-xs font-mono">+</span>
                <kbd className={KBD_CLASS}>←↑↓→</kbd>
              </span>
              <span className="text-zinc-500 text-[11px]">Naviguer tableau</span>
            </span>
            <span className="flex items-center gap-2">
              <kbd className={KBD_CLASS}>↑↓</kbd>
              <span className="text-zinc-500 text-[11px]">Liste</span>
            </span>
            <span className="flex items-center gap-2">
              <kbd className={KBD_CLASS}>⌘S</kbd>
              <span className="text-zinc-500 text-[11px]">Sauvegarder</span>
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
              onClick={requestClose}
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
                {isSaving ? 'Enregistrement...' : (saveLabel ?? 'Enregistrer')}
              </button>
            )}
          </div>
        </footer>
      </div>

      {/* Close confirmation overlay */}
      {showCloseConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={cancelClose}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 shadow-xl"
            style={{ width: '24rem' }}
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-zinc-100 font-semibold mb-2">
              Modifications non enregistrées
            </h2>
            <p className="text-zinc-400 text-sm mb-6">
              Vous avez des modifications en cours. Voulez-vous quitter sans enregistrer ?
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded text-sm text-zinc-300 hover:bg-zinc-800 border border-zinc-700 transition-colors"
                onClick={cancelClose}
              >
                Continuer
              </button>
              <button
                className="px-4 py-2 rounded text-sm bg-red-700 hover:bg-red-600 text-white font-medium transition-colors"
                onClick={confirmClose}
              >
                Quitter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
