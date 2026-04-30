import { useEffect } from 'react';
import type { ReactNode, MouseEvent } from 'react';
import { X } from 'lucide-react';

/**
 * Shared modal shell aligned on JCF tokens (rounded-[7px], bg-zinc-950,
 * header/footer in zinc-900 bands, explicit pixel padding 13/10 and
 * 20/13). Use the subcomponents for slots: ModalHeader, ModalBody,
 * ModalFooter, plus the button helpers for consistent action sizing.
 *
 * For simple yes/no flows, prefer ConfirmDialog over composing this
 * by hand.
 */

type IconTone = 'red' | 'emerald' | 'violet' | 'blue' | 'amber' | 'zinc';

const iconToneClass: Record<IconTone, string> = {
  red:     'bg-red-600/15 border-red-600/30 text-red-300',
  emerald: 'bg-emerald-600/15 border-emerald-600/30 text-emerald-300',
  violet:  'bg-violet-600/15 border-violet-600/30 text-violet-300',
  blue:    'bg-blue-600/15 border-blue-600/30 text-blue-300',
  amber:   'bg-amber-600/15 border-amber-600/30 text-amber-300',
  zinc:    'bg-zinc-800 border-zinc-700 text-zinc-300',
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Container width — number is treated as px; string passed through. */
  width?: number | string;
  /** Maximum height (e.g. '80vh'); when set, the body becomes scrollable. */
  maxHeight?: string;
  /** testId for the dialog card itself (the focused element, not the backdrop). */
  testId?: string;
  /** testId for the backdrop overlay (used by tests that click outside). */
  backdropTestId?: string;
  children: ReactNode;
  /** Optional override for backdrop click — defaults to onClose. */
  onBackdropClick?: () => void;
}

export function Modal({
  open,
  onClose,
  width = '28rem',
  maxHeight,
  testId,
  backdropTestId,
  children,
  onBackdropClick,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const widthStyle = typeof width === 'number' ? `${width}px` : width;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
      onClick={onBackdropClick ?? onClose}
      data-testid={backdropTestId}
    >
      <div
        className="rounded-[7px] border border-zinc-800 bg-zinc-950 shadow-2xl flex flex-col"
        style={{ width: widthStyle, maxHeight }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        data-testid={testId}
      >
        {children}
      </div>
    </div>
  );
}

interface ModalHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  iconTone?: IconTone;
  /** When omitted, no close button is shown (e.g. dwell-only modals). */
  onClose?: () => void;
  /** Trailing content placed before the close button (e.g. a "Prod actuelle" stamp). */
  extra?: ReactNode;
}

export function ModalHeader({ title, description, icon, iconTone = 'zinc', onClose, extra }: ModalHeaderProps) {
  return (
    <header className="bg-zinc-900 border-b border-zinc-800 px-[13px] py-[10px] flex items-center justify-between gap-3">
      <div className="flex items-center gap-[10px] min-w-0">
        {icon && (
          <div className={`w-7 h-7 rounded-[3px] border flex items-center justify-center shrink-0 ${iconToneClass[iconTone]}`}>
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-[15px] leading-[23px] font-medium text-zinc-100 truncate">{title}</div>
          {description && (
            <div className="text-[11px] text-zinc-500 truncate">{description}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {extra}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-[3px] text-zinc-400 hover:text-zinc-100 rounded-[3px] hover:bg-zinc-800/60"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        )}
      </div>
    </header>
  );
}

interface ModalBodyProps {
  children: ReactNode;
  /** Adds vertical spacing between direct children (e.g. 13 for `space-y-[13px]`). */
  gap?: number;
  /** When true, the body grows + scrolls within the modal's maxHeight. */
  scroll?: boolean;
  className?: string;
}

export function ModalBody({ children, gap, scroll, className = '' }: ModalBodyProps) {
  const gapStyle = gap ? { rowGap: `${gap}px` } : undefined;
  const scrollClass = scroll ? 'flex-1 overflow-y-auto min-h-0' : '';
  const flexCol = gap ? 'flex flex-col' : '';
  return (
    <div className={`px-[20px] py-[13px] ${flexCol} ${scrollClass} ${className}`} style={gapStyle}>
      {children}
    </div>
  );
}

interface ModalFooterProps {
  /** Optional small hint row above the actions row. */
  hint?: ReactNode;
  /** Optional error/info ribbon rendered above the hint row. */
  ribbon?: ReactNode;
  children: ReactNode;
}

export function ModalFooter({ hint, ribbon, children }: ModalFooterProps) {
  return (
    <footer className="bg-zinc-900 border-t border-zinc-800">
      {ribbon && (
        <div className="px-[13px] py-[8px] border-b border-zinc-800/50">
          {ribbon}
        </div>
      )}
      {hint && (
        <div className="px-[13px] py-[5px] text-[11px] text-zinc-500 border-b border-zinc-800/50">
          {hint}
        </div>
      )}
      <div className="px-[13px] py-[8px] flex items-center justify-end gap-[10px]">
        {children}
      </div>
    </footer>
  );
}

interface ButtonProps {
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  children: ReactNode;
  testId?: string;
  className?: string;
}

export function ModalCancelButton({ onClick, disabled, children = 'Annuler', testId, type = 'button' }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="px-[13px] py-[6px] text-sm rounded-[3px] bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-300 transition-colors"
    >
      {children}
    </button>
  );
}

type PrimaryVariant = 'primary' | 'destructive' | 'promote' | 'merge';

const primaryVariantClass: Record<PrimaryVariant, string> = {
  primary:     'bg-blue-600 hover:bg-blue-500 text-white',
  destructive: 'bg-red-600 hover:bg-red-500 text-white',
  promote:     'bg-emerald-600 hover:bg-emerald-500 text-white',
  merge:       'bg-violet-600 hover:bg-violet-500 text-white',
};

interface PrimaryButtonProps extends ButtonProps {
  variant?: PrimaryVariant;
}

export function ModalPrimaryButton({
  onClick,
  disabled,
  variant = 'primary',
  children,
  testId,
  type = 'button',
}: PrimaryButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={`px-[13px] py-[6px] text-sm rounded-[3px] font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${primaryVariantClass[variant]}`}
    >
      {children}
    </button>
  );
}
