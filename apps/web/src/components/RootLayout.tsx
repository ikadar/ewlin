import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar/Sidebar';

const STORAGE_KEY = 'lastSchedulingUrl';

/**
 * Root layout wrapper for all routes.
 * Provides the h-screen container, Sidebar, and Outlet.
 * Persists the last visited scheduling URL in sessionStorage so the
 * LayoutGrid icon can restore it when navigating back from settings.
 */
export function RootLayout() {
  const location = useLocation();
  const isSettings = location.pathname.startsWith('/settings');

  // Write to an external system (sessionStorage) — allowed in useEffect by react-hooks v7
  useEffect(() => {
    if (!isSettings) {
      sessionStorage.setItem(STORAGE_KEY, location.pathname + location.search);
    }
  }, [location.pathname, location.search, isSettings]);

  // Derive synchronously: if on a scheduling route, the current URL is the target;
  // if on settings, read the last saved scheduling URL from sessionStorage.
  const lastSchedulingUrl = isSettings
    ? (sessionStorage.getItem(STORAGE_KEY) ?? '/')
    : location.pathname + location.search;

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 flex overflow-hidden">
      <Sidebar lastSchedulingUrl={lastSchedulingUrl} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
