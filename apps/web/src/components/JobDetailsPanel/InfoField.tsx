export interface InfoFieldProps {
  /** Field label */
  label: string;
  /** Field value */
  value: string;
  /** Whether value should be monospace */
  mono?: boolean;
  /** Optional click handler (REQ-02: makes field clickable) */
  onClick?: () => void;
}

/**
 * Reusable field component with label and value.
 * Used in job info and status sections.
 */
export function InfoField({ label, value, mono = false, onClick }: InfoFieldProps) {
  const isClickable = !!onClick;
  const clickableClasses = isClickable
    ? 'cursor-pointer hover:underline hover:text-zinc-100 transition-colors'
    : '';

  return (
    <div>
      <div className="text-zinc-500 text-xs uppercase tracking-wide">{label}</div>
      <div
        className={`text-zinc-200 ${mono ? 'font-mono' : ''} ${clickableClasses}`}
        onClick={onClick}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
