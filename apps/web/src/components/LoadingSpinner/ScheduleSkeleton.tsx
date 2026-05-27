import { memo } from 'react';

const SIDEBAR_CARDS = 8;
const GRID_COLUMNS = 6;
const TILES_PER_COLUMN = [3, 2, 4, 2, 3, 1];
const TILE_HEIGHTS = [48, 32, 64, 28, 40, 56, 36, 52, 44, 60];

export const ScheduleSkeleton = memo(function ScheduleSkeleton() {
  return (
    <div
      className="fixed inset-0 flex bg-flux-base"
      role="status"
      aria-live="polite"
    >
      {/* Sidebar */}
      <div className="w-[270px] shrink-0 border-r border-flux-border flex flex-col gap-2 p-3 pt-12">
        {Array.from({ length: SIDEBAR_CARDS }, (_, i) => (
          <div
            key={i}
            className="rounded-md bg-flux-surface animate-pulse"
            style={{ height: 44, animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* DateStrip placeholder */}
        <div className="h-[38px] shrink-0 border-b border-flux-border flex items-center gap-6 px-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="h-4 w-16 rounded bg-flux-elevated animate-pulse"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>

        {/* Column headers */}
        <div className="shrink-0 border-b border-flux-border flex">
          <div className="w-12 shrink-0 border-r border-flux-border" />
          {Array.from({ length: GRID_COLUMNS }, (_, i) => (
            <div
              key={i}
              className="flex-1 min-w-[140px] px-3 py-2 border-r border-flux-border"
            >
              <div
                className="h-3.5 w-20 rounded bg-flux-elevated animate-pulse"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            </div>
          ))}
        </div>

        {/* Grid body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Timeline column */}
          <div className="w-12 shrink-0 border-r border-flux-border flex flex-col">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="h-[60px] flex items-start justify-end pr-1 pt-0.5">
                <div
                  className="h-2.5 w-6 rounded bg-flux-surface animate-pulse"
                  style={{ animationDelay: `${i * 60}ms` }}
                />
              </div>
            ))}
          </div>

          {/* Grid columns with tile placeholders */}
          {Array.from({ length: GRID_COLUMNS }, (_, colIdx) => (
            <div
              key={colIdx}
              className="flex-1 min-w-[140px] border-r border-flux-border relative"
            >
              {Array.from({ length: TILES_PER_COLUMN[colIdx] }, (_, tileIdx) => {
                const top = 20 + tileIdx * 90 + colIdx * 30;
                const h = TILE_HEIGHTS[(colIdx * 3 + tileIdx) % TILE_HEIGHTS.length];
                return (
                  <div
                    key={tileIdx}
                    className="absolute left-2 right-2 rounded bg-flux-elevated animate-pulse"
                    style={{
                      top,
                      height: h,
                      animationDelay: `${(colIdx * 3 + tileIdx) * 70}ms`,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Spinner overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/10 border-t-blue-500" />
        <p className="mt-3 text-xs text-flux-text-muted">Chargement en cours…</p>
      </div>
    </div>
  );
});
