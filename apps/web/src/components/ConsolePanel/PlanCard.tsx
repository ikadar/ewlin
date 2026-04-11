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
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-3">
      <div className="text-sm font-medium text-foreground whitespace-pre-wrap">{narration}</div>

      {resolvedEntities.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {resolvedEntities.map((e) => (
            <span
              key={`${e.kind}-${e.id}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-foreground"
              title={e.id}
            >
              <span className="text-muted-foreground">{ENTITY_LABEL[e.kind]} :</span>
              <span className="font-medium">{e.label}</span>
            </span>
          ))}
        </div>
      )}

      {actions.length > 0 && (
        <ul className="space-y-1 text-xs text-foreground">
          {actions.map((a, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 text-muted-foreground">•</span>
              <span>
                {a.preview ?? <code className="font-mono">{a.tool}</code>}
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
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isApplying ? 'Application…' : 'Appliquer'}
        </button>
        <button
          type="button"
          onClick={onEdit}
          disabled={isApplying}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          Modifier
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isApplying}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
