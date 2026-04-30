import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { SquareSlash } from 'lucide-react';
import { Sidebar } from './Sidebar/Sidebar';
import { CommandPalette } from './CommandPalette/CommandPalette';
import { CommandCenterProvider, useCommandCenter } from './CommandPalette/CommandCenterContext';
import { useCommands } from './CommandPalette/useCommands';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AutoRecomputeProvider, useAutoRecomputeCtx } from '../contexts/AutoRecomputeContext';
import { ScenarioProvider, useScenarioMode } from '../contexts/ScenarioContext';
import { EnvFloatingControls } from './EnvFloatingControls/EnvFloatingControls';
import { useMercureSubscription } from '../hooks/useMercureSubscription';
import { detectKeyboardLayout, isAltLetter } from '../utils/keyboardLayout';
import type { CompactHorizon } from '../utils';

function RootLayoutInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isOpen, setIsOpen, pageCommands, jobs, onSelectJob } = useCommandCenter();
  const { toastMessage, dismissToast } = useMercureSubscription();
  const { showToast } = useAutoRecomputeCtx();
  // The .env-readonly class on the shell drives the global CSS that
  // hides planning-only affordances (pin, snowflake) when in prod mode.
  // CompletionToggleIcon already gates itself in React.
  const { mode: scenarioMode } = useScenarioMode();

  // Pipe Mercure real-time updates into the unified compute toaster
  // (top-right). Reset Mercure local state immediately so the next
  // event re-fires the effect even if the message string is identical.
  useEffect(() => {
    if (!toastMessage) return;
    showToast({ type: 'info', title: toastMessage });
    dismissToast();
  }, [toastMessage, showToast, dismissToast]);

  const chordPendingRef = useRef<'compact' | 'placement' | null>(null);
  const chordTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shared commands available on all pages
  const sharedCommands = useCommands({
    onNavigateScheduler: useCallback(() => navigate('/'), [navigate]),
    onNavigateFlux: useCallback(() => navigate('/flux'), [navigate]),
    onNewJob: useCallback(() => navigate('/stations/job/new'), [navigate]),
    onSearchJobs: useCallback(() => navigate('/flux'), [navigate]),
    onCompactTimeline: useCallback((_h: CompactHorizon) => {
      // No-op at root level — compaction is page-specific and registered via context
    }, []),
  });

  // Merge shared + page-specific, deduplicating by id (page commands win)
  const allCommands = useMemo(() => {
    if (pageCommands.length === 0) return sharedCommands;
    const pageIds = new Set(pageCommands.map(c => c.id));
    const filtered = sharedCommands.filter(c => !pageIds.has(c.id));
    return [...filtered, ...pageCommands];
  }, [sharedCommands, pageCommands]);

  // Global keyboard handler for shared shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      detectKeyboardLayout(e);

      // Don't handle shortcuts when command palette is open
      if (isOpen) return;

      // Chord shortcut: if Alt+P was pressed, wait for S
      // Use keyCode because macOS remaps e.key under Alt (e.g. Alt+S → 'ß')
      if (chordPendingRef.current === 'placement') {
        chordPendingRef.current = null;
        if (chordTimeoutRef.current) { clearTimeout(chordTimeoutRef.current); chordTimeoutRef.current = null; }
        const map: Record<number, string> = { 83: 'asap-placement', 76: 'alap-placement' }; // 83 = S, 76 = L
        const cmdId = map[e.keyCode];
        if (cmdId) {
          e.preventDefault();
          allCommands.find(c => c.id === cmdId)?.action();
        }
        return; // consume chord regardless
      }

      // Chord shortcut: if Alt+C was pressed, wait for 1-5
      if (chordPendingRef.current === 'compact') {
        chordPendingRef.current = null;
        if (chordTimeoutRef.current) { clearTimeout(chordTimeoutRef.current); chordTimeoutRef.current = null; }
        const horizonMap: Record<string, string> = { '1': 'compact-4h', '2': 'compact-8h', '3': 'compact-24h', '4': 'compact-48h', '5': 'compact-72h' };
        const cmdId = horizonMap[e.key];
        if (cmdId) {
          e.preventDefault();
          const cmd = allCommands.find(c => c.id === cmdId);
          cmd?.action();
          return;
        }
      }

      // Alt+C: start compact chord
      if (isAltLetter(e, 'c')) {
        e.preventDefault();
        chordPendingRef.current = 'compact';
        if (chordTimeoutRef.current) clearTimeout(chordTimeoutRef.current);
        chordTimeoutRef.current = setTimeout(() => { chordPendingRef.current = null; }, 1500);
        return;
      }

      // Alt+K: open command palette (also hosts the natural-language AI console)
      if (isAltLetter(e, 'k')) {
        e.preventDefault();
        setIsOpen(true);
        return;
      }

      // Alt+P: chord prefix for placement (when available), else navigate to scheduler
      // Skip when on operator page (/) — it handles Alt+P for selective compute
      if (isAltLetter(e, 'p') && location.pathname !== '/') {
        e.preventDefault();
        if (allCommands.some(c => c.id === 'asap-placement' || c.id === 'alap-placement')) {
          chordPendingRef.current = 'placement';
          if (chordTimeoutRef.current) clearTimeout(chordTimeoutRef.current);
          chordTimeoutRef.current = setTimeout(() => {
            chordPendingRef.current = null;
            navigate('/');
          }, 1500);
        } else {
          navigate('/');
        }
        return;
      }

      // Alt+X: navigate to flux
      if (isAltLetter(e, 'x')) {
        e.preventDefault();
        navigate('/flux');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setIsOpen, navigate, allCommands, location.pathname]);

  return (
    <div
      className={`h-screen bg-zinc-950 text-zinc-100 flex overflow-hidden ${
        scenarioMode === 'prod' ? 'env-readonly prod-shell-glow' : 'preprod-shell-glow'
      }`}
    >
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </div>

      {/* Env switcher + Promouvoir CTA — global, visible on every page,
          parked to the left of the Command Center FAB. Replaces the
          per-page PlanningEnvHeader bandeau. */}
      <EnvFloatingControls />

      {/* Floating command center button */}
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

      {/* Command palette */}
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

/**
 * Root layout wrapper for all routes.
 * Provides the h-screen container, Sidebar, Outlet, and global Command Center.
 */
export function RootLayout() {
  return (
    <ThemeProvider>
      <CommandCenterProvider>
        <AutoRecomputeProvider>
          <ScenarioProvider>
            <RootLayoutInner />
          </ScenarioProvider>
        </AutoRecomputeProvider>
      </CommandCenterProvider>
    </ThemeProvider>
  );
}
