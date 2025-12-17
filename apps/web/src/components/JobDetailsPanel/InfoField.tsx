export interface InfoFieldProps {
  /** Field label */
  label: string;
  /** Field value */
  value: string;
  /** Whether value should be monospace */
  mono?: boolean;
}

/**
 * Reusable field component with label and value.
 * Used in job info and status sections.
 */
export function InfoField({ label, value, mono = false }: InfoFieldProps) {
  return (
    <div>
      <div className="text-zinc-500 text-xs uppercase tracking-wide">{label}</div>
      <div className={`text-zinc-200 ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}
