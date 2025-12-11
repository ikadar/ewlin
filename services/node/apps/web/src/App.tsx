import type { ReactNode } from 'react';
import { useAppSelector, useAppDispatch } from './app/hooks';
import { toggleLeftPanel, toggleRightPanel } from './app/uiSlice';

function App(): ReactNode {
  const dispatch = useAppDispatch();
  const panels = useAppSelector((state) => state.ui.panels);

  return (
    <div className="min-h-screen bg-flux-bg-main">
      {/* Header */}
      <header className="bg-flux-bg-panel border-b border-flux-border px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-flux-text">Flux Scheduler</h1>
          <div className="flex gap-2">
            <button
              className="btn btn-secondary text-sm"
              onClick={() => dispatch(toggleLeftPanel())}
            >
              {panels.left ? 'Hide' : 'Show'} Jobs
            </button>
            <button
              className="btn btn-secondary text-sm"
              onClick={() => dispatch(toggleRightPanel())}
            >
              {panels.right ? 'Hide' : 'Show'} Details
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex h-[calc(100vh-65px)]">
        {/* Left Panel - Jobs */}
        {panels.left && (
          <aside className="w-72 border-r border-flux-border bg-flux-bg-panel p-4">
            <h2 className="text-sm font-medium text-flux-text-muted uppercase tracking-wide mb-4">
              Jobs
            </h2>
            <p className="text-flux-text-light text-sm">Job list will be implemented in M3</p>
          </aside>
        )}

        {/* Center - Schedule Grid */}
        <section className="flex-1 overflow-auto bg-flux-bg-grid p-4">
          <div className="panel p-6 text-center">
            <h2 className="text-lg font-medium text-flux-text mb-2">Schedule Grid</h2>
            <p className="text-flux-text-muted">
              The scheduling grid will be implemented in Milestone 3.
            </p>
            <p className="text-flux-text-light text-sm mt-4">
              Foundation ready: React 19 + Redux Toolkit + Tailwind CSS 4
            </p>
          </div>
        </section>

        {/* Right Panel - Details */}
        {panels.right && (
          <aside className="w-80 border-l border-flux-border bg-flux-bg-panel p-4">
            <h2 className="text-sm font-medium text-flux-text-muted uppercase tracking-wide mb-4">
              Job Details
            </h2>
            <p className="text-flux-text-light text-sm">Details panel will be implemented in M3</p>
          </aside>
        )}
      </main>
    </div>
  );
}

export default App;
