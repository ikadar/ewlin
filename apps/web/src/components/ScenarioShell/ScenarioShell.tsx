/**
 * V2 scenario shell — full-screen layout for working *inside* a fork.
 *
 * URL contract: every route under `/scenarios/:id/*` mounts this
 * shell. The scenario id in the URL is auto-picked-up by
 * `realBaseQuery`, which sets `X-Flux-Scenario: <uuid>` on every API
 * call, so the entire page tree reads/writes scoped to the fork.
 *
 * Visual contract: violet glow on the viewport edges (CSS
 * `.scenario-shell-glow`) is the *exclusive* marker for fork mode —
 * the chef knows they're outside Préprod without reading any label.
 * The actions (merge / delete) live in a bottom-right dock card
 * (variant D), aligned graphically with the Préprod/Prod dock.
 */
import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { AutoRecomputeProvider } from '../../contexts/AutoRecomputeContext';
import { ScenarioProvider } from '../../contexts/ScenarioContext';
import { CommandCenterProvider } from '../CommandPalette/CommandCenterContext';
import {
  useGetSimulationQuery,
  useDeleteSimulationMutation,
} from '../../store';
import { ScenarioSidebar } from './ScenarioSidebar';
import { ScenarioDockCard } from './ScenarioDockCard';
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

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 flex overflow-hidden scenario-shell-glow">
      <ScenarioSidebar scenarioId={id} currentPath={location.pathname} />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Outlet />
      </div>

      <ScenarioDockCard
        scenario={scenario}
        onDelete={handleDelete}
        onPromote={() => setMergeOpen(true)}
      />

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
  // Wraps the inner shell with the same context providers as
  // RootLayout so existing pages (planning, flux, settings…) get
  // what they need when rendered under the scenario route tree.
  // ScenarioProvider is mandatory — every page tree calls
  // useScenarioMode() somewhere; without it React throws and the
  // shell renders a blank screen.
  return (
    <ThemeProvider>
      <ScenarioProvider>
        <CommandCenterProvider>
          <AutoRecomputeProvider>
            <ScenarioShellInner />
          </AutoRecomputeProvider>
        </CommandCenterProvider>
      </ScenarioProvider>
    </ThemeProvider>
  );
}
