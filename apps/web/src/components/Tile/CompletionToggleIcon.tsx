/**
 * Round completion indicator on a tile.
 *
 * Domain rule (per the V1 versioning design owner):
 *   - Completion is execution truth, reportable from the prod view only.
 *   - In preprod the icon is a frozen mirror (cursor default, click no-op);
 *     it shows what operators have reported but the chef cannot fake it.
 *   - In prod the icon is interactive; clicking dual-writes the toggle to
 *     prod_completion_overlay AND the live preprod Schedule via the
 *     POST /api/v1/scenarios/prod/completion/{taskId} endpoint.
 *
 * Reusable in Tile.tsx (station view) and TileSegment.tsx (operator view).
 */
import { CheckCircle2, Circle } from 'lucide-react';
import { useScenarioMode } from '../../contexts/ScenarioContext';
import { useToggleProdCompletionMutation } from '../../store';

interface CompletionToggleIconProps {
  taskId: string;
  isCompleted: boolean;
  /** Optional callback fired AFTER a successful toggle in prod mode (e.g. to invalidate the snapshot cache). */
  onToggled?: (newState: boolean) => void;
  /** Override the default icon dimensions (default: 'w-3 h-3' to match grid tiles). */
  iconClassName?: string;
}

export function CompletionToggleIcon({ taskId, isCompleted, onToggled, iconClassName = 'w-3 h-3' }: CompletionToggleIconProps) {
  const { mode } = useScenarioMode();
  const [toggleProdCompletion, { isLoading }] = useToggleProdCompletionMutation();

  const interactive = mode === 'prod';
  const Icon = isCompleted ? CheckCircle2 : Circle;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!interactive || isLoading) return;
    try {
      const result = await toggleProdCompletion(taskId).unwrap();
      onToggled?.(result.isCompleted);
    } catch {
      // Mutation failed — keep current state. The next snapshot
      // refetch will reconcile if needed.
    }
  };

  const colorClass = isCompleted
    ? 'text-emerald-400 hover:text-emerald-300'
    : 'text-zinc-700 hover:text-zinc-400';

  return (
    <span
      onClick={handleClick}
      className={`p-1 -m-1 rounded shrink-0 inline-flex items-center align-middle mr-1 transition-colors ${
        interactive ? 'pointer-events-auto cursor-pointer hover:bg-white/5' : 'pointer-events-none'
      } ${colorClass}`}
      title={
        interactive
          ? isCompleted
            ? 'Avancement · cliquer pour annuler'
            : 'Avancement · cliquer pour marquer terminé'
          : isCompleted
            ? 'Terminé (modifiable depuis la vue Prod)'
            : 'Avancement (modifiable depuis la vue Prod)'
      }
      data-testid="tile-completion-toggle"
      data-task-id={taskId}
      data-completed={isCompleted ? 'true' : 'false'}
      data-mode={mode}
    >
      <Icon className={`${iconClassName} shrink-0`} />
    </span>
  );
}
