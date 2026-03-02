import { FluxTable } from '@/components/FluxTable';
import { FLUX_STATIC_JOBS } from '@/mock/fluxStaticData';

/**
 * Production Flow Dashboard page (/flux).
 * Spec: docs/production-flow-dashboard-spec/tableau-de-flux.md
 * v0.5.15: Static table display only (no filtering, no interactivity).
 */
export function FluxPage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-flux-base">
      {/* Page header */}
      <div className="px-6 py-4 border-b border-flux-border bg-flux-elevated">
        <h1 className="text-xl font-semibold text-flux-text-primary">
          Flux de production
        </h1>
      </div>

      {/* Table area */}
      <div className="flex-1 overflow-hidden">
        <div className="p-6 h-full">
          <div className="bg-flux-elevated rounded-lg border border-flux-border h-full overflow-hidden">
            <FluxTable jobs={FLUX_STATIC_JOBS} />
          </div>
        </div>
      </div>
    </div>
  );
}
