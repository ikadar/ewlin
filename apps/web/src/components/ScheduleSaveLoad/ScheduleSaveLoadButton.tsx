import { Save } from 'lucide-react';

export interface ScheduleSaveLoadButtonProps {
  onClick: () => void;
}

export function ScheduleSaveLoadButton({ onClick }: ScheduleSaveLoadButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide text-zinc-300 bg-zinc-700 hover:bg-zinc-600 transition-colors"
      title="Sauvegardes"
      data-testid="schedule-save-load-button"
    >
      <Save className="w-3.5 h-3.5" />
      Sauvegardes
    </button>
  );
}
