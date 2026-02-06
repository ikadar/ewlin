/**
 * QA Tracker Page
 *
 * Main page component for the QA Tracker tool.
 * Provides 4-column layout for test navigation and tracking.
 */

import { QALayout } from './components/QALayout';

const SCHEDULER_URL = import.meta.env.VITE_SCHEDULER_URL || 'http://localhost:5173';

export function QATrackerPage() {
  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">QA Tracker</h1>
          <span className="text-xs text-zinc-500">Manual QA Test Tracking</span>
        </div>
        <a
          href={SCHEDULER_URL}
          className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Back to Scheduler
        </a>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <QALayout />
      </main>
    </div>
  );
}
