import type { LucideIcon } from 'lucide-react';

interface FluxEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  message?: string;
  error?: boolean;
}

export function FluxEmptyState({ icon: Icon, title, message, error }: FluxEmptyStateProps) {
  return (
    <div className={`flex-1 flex flex-col items-center justify-center gap-1 py-12 ${error ? 'text-red-400' : 'text-flux-text-muted'} text-sm`}>
      {Icon && <Icon className="w-5 h-5 mb-1" strokeWidth={1.5} />}
      <span>{title}</span>
      {message && <span className="text-xs text-flux-text-tertiary">{message}</span>}
    </div>
  );
}
