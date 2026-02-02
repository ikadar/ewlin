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
  const baseClasses = `text-zinc-200 ${mono ? 'font-mono' : ''}`;

  return (
    <div>
      <div className="text-zinc-500 text-xs uppercase tracking-wide">{label}</div>
      {onClick ? (
        <button
          type="button"
          className={`${baseClasses} cursor-pointer hover:underline hover:text-zinc-100 transition-colors text-left`}
          onClick={onClick}
        >
          {value}
        </button>
      ) : (
        <div className={baseClasses}>{value}</div>
      )}
    </div>
  );
}
