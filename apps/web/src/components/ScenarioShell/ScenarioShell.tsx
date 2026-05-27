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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { SquareSlash } from 'lucide-react';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { AutoRecomputeProvider } from '../../contexts/AutoRecomputeContext';
import { ScenarioProvider } from '../../contexts/ScenarioContext';
import { useScenarioCacheReset } from '../../hooks/useScenarioCacheReset';
import { CommandCenterProvider, useCommandCenter } from '../CommandPalette/CommandCenterContext';
import { CommandPalette } from '../CommandPalette/CommandPalette';
import { useCommands } from '../CommandPalette/useCommands';
import { detectKeyboardLayout, isAltLetter } from '../../utils/keyboardLayout';
import {
  useGetSimulationQuery,
  useDeleteSimulationMutation,
} from '../../store';
import { ScenarioSidebar } from './ScenarioSidebar';
import { ScenarioDockCard } from './ScenarioDockCard';
import { MergePreviewDialog } from './MergePreviewDialog';
import { ConfirmDialog } from '../Modal';

function ScenarioShellInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { data: scenario, isLoading } = useGetSimulationQuery(id ?? '', { skip: !id });
  const [deleteSimulation] = useDeleteSimulationMutation();
  const [mergeOpen, setMergeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { isOpen, setIsOpen, pageCommands, jobs, onSelectJob } = useCommandCenter();

  // Drop scenario-scoped caches whenever the env flips inside the
  // fork shell — same rationale as in RootLayout.
  useScenarioCacheReset();

  const scenarioName = scenario?.name ?? '';
  const subPage = location.pathname.endsWith('/flux') ? ' Flux'
    : location.pathname.endsWith('/stations') ? ' Stations'
    : location.pathname.includes('/settings') ? ' Réglages'
    : '';
  useDocumentTitle(scenarioName ? `${scenarioName}${subPage}` : `Scénario${subPage}`, 'preprod');

  // Bail if URL is malformed — back to the list.
  useEffect(() => {
    if (!id) navigate('/scenarios');
  }, [id, navigate]);

  // Shared palette commands, scoped to the active fork. Navigation
  // targets stay under /scenarios/:id so the chef never silently
  // exits the fork via the palette. onNewJob is a no-op because the
  // JCF route is not yet mounted under the scenario shell.
  const sharedCommands = useCommands({
    onNavigateScheduler: useCallback(() => { if (id) navigate(`/scenarios/${id}`); }, [navigate, id]),
    onNavigateFlux: useCallback(() => { if (id) navigate(`/scenarios/${id}/flux`); }, [navigate, id]),
    onNewJob: useCallback(() => {}, []),
    onSearchJobs: useCallback(() => { if (id) navigate(`/scenarios/${id}/flux`); }, [navigate, id]),
    onSmartCompact: useCallback(() => {}, []),
    onEvaluateSchedule: useCallback(() => {}, []),
  });

  const allCommands = useMemo(() => {
    if (pageCommands.length === 0) return sharedCommands;
    const pageIds = new Set(pageCommands.map(c => c.id));
    const filtered = sharedCommands.filter(c => !pageIds.has(c.id));
    return [...filtered, ...pageCommands];
  }, [sharedCommands, pageCommands]);

  // Mirror RootLayout's Alt+K / Alt+X / Alt+P shortcuts so the
  // palette (and the AI console nested in it) is reachable inside
  // a fork. Chord shortcuts (Alt+P S / L, Alt+C 1..5) intentionally
  // omitted for now — page commands are still clickable from the
  // palette UI.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      detectKeyboardLayout(e);
      if (isOpen) return;
      if (!id) return;

      if (isAltLetter(e, 'k')) {
        e.preventDefault();
        setIsOpen(true);
        return;
      }
      if (isAltLetter(e, 'x')) {
        e.preventDefault();
        navigate(`/scenarios/${id}/flux`);
        return;
      }
      if (isAltLetter(e, 'p') && location.pathname !== `/scenarios/${id}`) {
        e.preventDefault();
        navigate(`/scenarios/${id}`);
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setIsOpen, navigate, location.pathname, id]);

  if (!id || isLoading || !scenario) {
    return (
      <div className="h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-xs text-zinc-500">Chargement du scénario…</div>
      </div>
    );
  }

  const handleDelete = () => setDeleteOpen(true);
  const handleConfirmDelete = async () => {
    setDeleteOpen(false);
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

      <ConfirmDialog
        open={deleteOpen}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Supprimer ce scénario ?"
        description={(
          <>
            <span className="text-zinc-100 font-medium">«&nbsp;{scenario.name ?? id}&nbsp;»</span>
            {' '}et toutes ses modifications seront perdus définitivement.
          </>
        )}
        variant="destructive"
        testId="scenario-delete-confirm"
      />

      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
          aria-label="Open command center"
          data-testid="command-center-fab"
        >
          <SquareSlash size={24} />
        </button>
      )}

      <CommandPalette
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        commands={allCommands}
        jobs={jobs}
        onSelectJob={onSelectJob}
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
