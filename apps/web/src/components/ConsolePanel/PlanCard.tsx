/**
 * Card rendering a Gemma-proposed plan, awaiting user confirmation.
 *
 * Shows: narration, resolved entities (so the user can verify the LLM
 * picked the right Frédéric / right machine), the list of actions with
 * a human-readable preview, and the three confirmation buttons.
 */

import type { ProposedAction, ResolvedEntity } from '../../store/api/consoleApi';

interface PlanCardProps {
  narration: string;
  actions: ProposedAction[];
  resolvedEntities: ResolvedEntity[];
  isApplying: boolean;
  onApply: () => void;
  onEdit: () => void;
  onCancel: () => void;
}

const ENTITY_LABEL: Record<ResolvedEntity['kind'], string> = {
  operator: 'Opérateur',
  station: 'Machine',
  job: 'Dossier',
  task: 'Tâche',
};

export function PlanCard({
  narration,
  actions,
  resolvedEntities,
  isApplying,
  onApply,
  onEdit,
  onCancel,
}: PlanCardProps) {
  return (
    <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 p-4 space-y-3">
      <div className="text-sm font-medium text-zinc-100 whitespace-pre-wrap">{narration}</div>

      {resolvedEntities.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {resolvedEntities.map((e) => (
            <span
              key={`${e.kind}-${e.id}`}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-100"
              title={e.id}
            >
              <span className="text-zinc-400">{ENTITY_LABEL[e.kind]} :</span>
              <span className="font-medium">{e.label}</span>
            </span>
          ))}
        </div>
      )}

      {actions.length > 0 && (
        <ul className="space-y-1 text-xs text-zinc-200">
          {actions.map((a, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 text-zinc-500">•</span>
              <span>
                {a.preview ?? <code className="font-mono text-zinc-300">{a.tool}</code>}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onApply}
          disabled={isApplying || actions.length === 0}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {isApplying ? 'Application…' : 'Appliquer'}
        </button>
        <button
          type="button"
          onClick={onEdit}
          disabled={isApplying}
          className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
        >
          Modifier
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isApplying}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
