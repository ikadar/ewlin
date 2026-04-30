/**
 * V2 scenario shell — full-screen layout for working *inside* a fork.
 *
 * URL contract: every route under `/scenarios/:id/*` mounts this
 * shell. The scenario id in the URL is auto-picked-up by
 * `realBaseQuery`, which sets `X-Flux-Scenario: <uuid>` on every API
 * call, so the entire page tree reads/writes scoped to the fork.
 *
 * Visual contract: violet bandeau on top so the chef *always* knows
 * they're not in Préprod, plus a 5-entry sidebar that limits the
 * surface to what's editable in a branch (planning op, planning
 * stations, flux, stations config, opérateurs config).
 */
import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, FlaskConical, GitMerge, Trash2 } from 'lucide-react';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { AutoRecomputeProvider } from '../../contexts/AutoRecomputeContext';
import { CommandCenterProvider } from '../CommandPalette/CommandCenterContext';
import {
  useGetSimulationQuery,
  useDeleteSimulationMutation,
} from '../../store';
import { ScenarioSidebar } from './ScenarioSidebar';
import { MergePreviewDialog } from './MergePreviewDialog';

function ScenarioShellInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { data: scenario, isLoading } = useGetSimulationQuery(id ?? '', { skip: !id });
  const [deleteSimulation] = useDeleteSimulationMutation();
  const [mergeOpen, setMergeOpen] = useState(false);

  // Bail if URL is malformed — back to the list.
  useEffect(() => {
    if (!id) navigate('/scenarios');
  }, [id, navigate]);

  if (!id || isLoading || !scenario) {
    return (
      <div className="h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-xs text-zinc-500">Chargement du scénario…</div>
      </div>
    );
  }

  const handleDelete = async () => {
    const ok = window.confirm(`Supprimer le scénario "${scenario.name ?? id}" ? Toutes ses modifications seront perdues.`);
    if (!ok) return;
    await deleteSimulation(id);
    navigate('/scenarios');
  };

  const handleMerged = () => {
    setMergeOpen(false);
    // After merge the scenario is read-only (merged_at stamped). Send
    // the chef back to /scenarios so they see the merged badge.
    navigate('/scenarios');
  };

  const isMerged = scenario.mergedAt !== null;

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden">
      <header className="bg-violet-950/40 border-b border-violet-700/40 px-4 py-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/scenarios')}
          className="w-8 h-8 flex items-center justify-center rounded-md text-violet-300 hover:bg-violet-900/40"
          aria-label="Retour à la liste des scénarios"
          data-testid="scenario-shell-back"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <FlaskConical size={16} className="text-violet-300 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-violet-100 truncate flex items-center gap-2">
              <span>Scénario · {scenario.name ?? '(sans nom)'}</span>
              {isMerged && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-600/20 border border-emerald-600/40 text-emerald-300">
                  Mergé
                </span>
              )}
            </div>
            <div className="text-[10px] text-violet-400">
              Forké de la préprod{scenario.parentScenarioId ? '' : ' (lineage manquante)'} · les modifications restent locales tant qu'on ne merge pas
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] bg-zinc-900/60 hover:bg-rose-950/50 hover:text-rose-300 border border-zinc-800 text-zinc-300"
          title="Supprimer ce scénario"
        >
          <Trash2 size={11} />
          Supprimer
        </button>
        <button
          type="button"
          onClick={() => setMergeOpen(true)}
          disabled={isMerged}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          title={isMerged ? 'Déjà mergé' : 'Replayer les modifications dans la préprod'}
          data-testid="scenario-merge-trigger"
        >
          <GitMerge size={13} />
          Promouvoir vers préprod
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <ScenarioSidebar scenarioId={id} currentPath={location.pathname} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Outlet />
        </div>
      </div>

      <MergePreviewDialog
        open={mergeOpen}
        scenarioId={id}
        scenarioName={scenario.name ?? id}
        onClose={() => setMergeOpen(false)}
        onMerged={handleMerged}
      />
    </div>
  );
}

export function ScenarioShell() {
  // Wraps the inner shell with the same context providers as the main
  // app so existing pages (planning, flux, settings…) get what they
  // need when rendered under the scenario route tree.
  return (
    <ThemeProvider>
      <CommandCenterProvider>
        <AutoRecomputeProvider>
          <ScenarioShellInner />
        </AutoRecomputeProvider>
      </CommandCenterProvider>
    </ThemeProvider>
  );
}
