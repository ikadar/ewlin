import { Outlet } from 'react-router-dom';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { ScenarioProvider } from '../../contexts/ScenarioContext';
import { useMercureSubscription } from '../../hooks/useMercureSubscription';

function FocusLayoutInner() {
  // Subscribe to Mercure for cache invalidation only — the visual
  // "Planning mis à jour" notification is intentionally suppressed in
  // /focus to keep the layout distraction-free.
  useMercureSubscription();

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden">
      <Outlet />
    </div>
  );
}

/**
 * FocusLayout — minimal layout for /focus/* routes.
 * No sidebar, no command palette, no command-center FAB —
 * intentionally stripped so the mobile-first focus view stays distraction-free.
 *
 * ScenarioProvider is mounted here (mirroring RootLayout) so any tile
 * inside /focus/* can call `useScenarioMode()` — notably the
 * CompletionToggleIcon embedded in TileSegment, which the operator uses
 * to mark execution truth from the focus view.
 */
export function FocusLayout() {
  return (
    <ThemeProvider>
      <ScenarioProvider defaultMode="prod">
        <FocusLayoutInner />
      </ScenarioProvider>
    </ThemeProvider>
  );
}
