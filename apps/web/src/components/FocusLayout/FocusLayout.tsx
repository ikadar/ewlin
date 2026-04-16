import { Outlet } from 'react-router-dom';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { useMercureSubscription } from '../../hooks/useMercureSubscription';
import { Toast } from '../Toast/Toast';

function FocusLayoutInner() {
  const { toastMessage, dismissToast } = useMercureSubscription();

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden">
      <Outlet />
      <Toast
        type="info"
        message={toastMessage ?? ''}
        isVisible={!!toastMessage}
        onDismiss={dismissToast}
      />
    </div>
  );
}

/**
 * FocusLayout — minimal layout for /focus/* routes.
 * No sidebar, no command palette, no console panel, no command-center FAB —
 * intentionally stripped so the mobile-first focus view stays distraction-free
 * and avoids collision with the floating NOW button (bottom-right).
 */
export function FocusLayout() {
  return (
    <ThemeProvider>
      <FocusLayoutInner />
    </ThemeProvider>
  );
}
