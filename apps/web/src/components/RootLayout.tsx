import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar/Sidebar';

/**
 * Root layout wrapper for all routes.
 * Provides the h-screen container, Sidebar, and Outlet.
 */
export function RootLayout() {
  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
