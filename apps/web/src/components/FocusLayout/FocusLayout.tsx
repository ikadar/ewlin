import { Outlet } from 'react-router-dom';
import { ThemeProvider } from '../../contexts/ThemeContext';
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
 */
export function FocusLayout() {
  return (
    <ThemeProvider>
      <FocusLayoutInner />
    </ThemeProvider>
  );
}
