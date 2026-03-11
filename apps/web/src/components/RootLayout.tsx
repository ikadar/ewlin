import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar/Sidebar';
import { Toast } from './Toast/Toast';
import { useMercureSubscription } from '../hooks/useMercureSubscription';

/**
 * Root layout wrapper for all routes.
 * Provides the h-screen container, Sidebar, and Outlet.
 */
export function RootLayout() {
  const { toastMessage, dismissToast } = useMercureSubscription();

  return (
    <>
      <div className="h-screen bg-zinc-950 text-zinc-100 flex overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Outlet />
        </div>
      </div>
      <Toast
        type="info"
        message={toastMessage ?? ''}
        isVisible={!!toastMessage}
        onDismiss={dismissToast}
      />
    </>
  );
}
