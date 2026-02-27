import { useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar/Sidebar';

/**
 * Root layout wrapper for all routes.
 * Provides the h-screen container, Sidebar, and Outlet.
 * Tracks the last visited scheduling URL so the Sidebar can restore it.
 */
export function RootLayout() {
  const location = useLocation();
  const lastSchedulingUrl = useRef('/');

  const isSettingsRoute = location.pathname.startsWith('/settings');
  if (!isSettingsRoute) {
    lastSchedulingUrl.current = location.pathname + location.search;
  }

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 flex overflow-hidden">
      <Sidebar lastSchedulingUrl={lastSchedulingUrl.current} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
