import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ShortcutFooter } from '@/components/ShortcutFooter/ShortcutFooter';
import { detectKeyboardLayout, isAltLetter } from '@/utils/keyboardLayout';
import { useLocation } from 'react-router-dom';
import { useEnvAwareNavigate, useScenarioMode } from '@/contexts/ScenarioContext';
import { useToast } from '@/hooks/useToast';
import { FluxTable } from '@/components/FluxTable';
import { FluxToolbar } from '@/components/FluxToolbar';
import { FluxTabBar } from '@/components/FluxTabBar';
import { FluxDeleteConfirmDialog } from '@/components/FluxTable/FluxDeleteConfirmDialog';
import { JobModificationContainer } from '@/components/JcfModificationModal/JobModificationContainer';
import { useGetFluxJobsQuery, useUpdateSTStatusMutation, useUpdateElementPrerequisiteMutation, useUpdateJobShipperMutation, useToggleJobShippedMutation, useToggleJobInvoicedMutation, useUpdateJobPriorityMutation, useGetShippersQuery, useAppDispatch, useDeleteJobMutation, fluxApi, setError, useGetSnapshotQuery } from '@/store';
import { useRecordProgressDirectMutation } from '@/store/api/saisieApi';
import { useGetStationCategoriesQuery } from '@/store/api/stationCategoryApi';
import type { FluxSTStatus, PrerequisiteColumn, PrerequisiteStatus } from '@/components/FluxTable/fluxTypes';
import {
  computeTabCounts,
  EMPTY_FLUX_FILTERS,
  filterByCriteria,
  filterBySearch,
  filterByTab,
  pathnameToTab,
  tabToPathname,
  TAB_IDS,
  TAB_LABELS,
  type FluxFilters,
} from '@/components/FluxTable/fluxFilters';
import { sortFluxJobs, type SortColumn, type SortDirection } from '@/components/FluxTable/fluxSort';

/**
 * Production Flow Dashboard page (/flux, /flux/prepresse, etc.).
 * Spec: docs/production-flow-dashboard-spec/tableau-de-flux.md
 * v0.5.16: Tab filtering, full-text search, URL persistence, keyboard shortcuts.
 * v0.5.17: Prerequisite listbox, expand/collapse, delete confirmation, edit navigation.
 */
export function FluxPage({ backdrop }: { backdrop?: boolean } = {}) {
  const location = useLocation();
  const navigate = useEnvAwareNavigate();

  const activeTab = pathnameToTab(location.pathname);
  const dispatch = useAppDispatch();

  // ── API data (RTK Query cache as source of truth) ─────────────────────────
  // Refetch on mount to pick up changes made in the scheduler
  const { data: jobs = [], isLoading: isJobsLoading, isError } = useGetFluxJobsQuery(undefined, { refetchOnMountOrArgChange: true });
  const { data: categories = [], isLoading: isCategoriesLoading } = useGetStationCategoriesQuery();

  const isLoading = isJobsLoading || isCategoriesLoading;

  // Categories sorted by displayOrder, then name for stable ordering
  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) =>
      a.displayOrder !== b.displayOrder
        ? a.displayOrder - b.displayOrder
        : a.name.localeCompare(b.name)
    ),
    [categories],
  );
  const [updateSTStatus] = useUpdateSTStatusMutation();
  const [updateElementPrerequisite] = useUpdateElementPrerequisiteMutation();
  const [updateJobShipper] = useUpdateJobShipperMutation();
  const [toggleJobShipped] = useToggleJobShippedMutation();
  const [toggleJobInvoiced] = useToggleJobInvoicedMutation();
  const [updateJobPriority] = useUpdateJobPriorityMutation();
  const [deleteJob] = useDeleteJobMutation();
  const { data: shippers = [] } = useGetShippersQuery();
  const { data: snapshot } = useGetSnapshotQuery();
  // /flux reality writes (BAT, papier, formes, plaques, ST, parti, facturé)
  // are Prod-only. Backend rejects them in Préprod (FluxProdOnlyGuardSubscriber
  // + JobController inline guard) ; the UI short-circuits with a hint so
  // users don't see optimistic flickers and silent failures.
  const { mode } = useScenarioMode();
  // Wall writes (gate states + ST/Parti/Facturé) are Prod-only ;
  // job-shape edits (sequence, deadline, priority, gate `needsX`) live
  // in Préprod where they're tentative until publish. The toggles
  // mirror the asymmetry described in
  // docs/architecture/preprod-prod-photo-model.md (Pillar A + B).
  const canEditFluxReality = mode === 'prod';
  const canEditJobShape = mode === 'preprod';
  const { showToast } = useToast();

  // Late job IDs from schedule snapshot
  const lateJobIds = useMemo(() => {
    if (!snapshot) return new Set<string>();
    return new Set(snapshot.lateJobs.map(lj => lj.jobId));
  }, [snapshot]);

  // Conflict job IDs derived from schedule snapshot (excluding DeadlineConflict — those are late, not conflicts)
  const conflictJobIds = useMemo(() => {
    if (!snapshot) return new Set<string>();
    const ids = new Set<string>();
    snapshot.conflicts
      .filter(c => c.type !== 'DeadlineConflict' && c.type !== 'ApprovalGateConflict')
      .forEach(c => {
        const task = snapshot.tasks.find(t => t.id === c.taskId);
        if (task) {
          const el = snapshot.elements.find(e => e.id === task.elementId);
          if (el?.jobId) ids.add(el.jobId);
        }
      });
    return ids;
  }, [snapshot]);

  // ── Local UI state (not tied to server data) ──────────────────────────────
  const [expandedJobIds, setExpandedJobIds] = useState<Set<string>>(new Set());
  const [deleteConfirmJobId, setDeleteConfirmJobId] = useState<string | null>(null);
  const [editingJobInternalId, setEditingJobInternalId] = useState<string | null>(null);
  // Mode avancement (Prod-only). When active, FluxTable replaces the
  // station-cell content with bi-state round checkboxes that map to
  // "saisie d'avancement 100% / 0%" via recordProgressDirect. The rond
  // is no longer a separate flag — it's a shortcut over the unique
  // effort-tracking channel (cf. avancement remise-à-plat Phase 2,
  // 2026-05-24).
  const [advancementMode, setAdvancementMode] = useState(false);
  // Auto-exit when leaving Prod — the toggle is hidden in Préprod
  // anyway, but the state was kept across mode flips would surprise
  // a user toggling back to Prod and finding the rounds still on.
  useEffect(() => {
    if (mode !== 'prod' && advancementMode) {
      setAdvancementMode(false);
    }
  }, [mode, advancementMode]);
  const [recordProgressDirect] = useRecordProgressDirectMutation();
  const handleSetTaskCompletion = useCallback((taskId: string, completed: boolean) => {
    void recordProgressDirect({ taskId, progressPct: completed ? 100 : 0 });
  }, [recordProgressDirect]);

  // ── Search / keyboard state ──────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FluxFilters>(EMPTY_FLUX_FILTERS);
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Sort state (v0.5.21) ─────────────────────────────────────────────────
  const [sortColumn, setSortColumn] = useState<SortColumn>('id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSortChange = useCallback((column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }, [sortColumn]);

  // Status context shared by the criteria filter and the table — derived
  // once so both surfaces agree on what "planifié" / "en retard" means.
  const statusContext = useMemo(
    () => ({ lateJobIds, conflictJobIds }),
    [lateJobIds, conflictJobIds],
  );

  // Filtered + sorted jobs: tab filter → search → criteria → sort
  const filteredJobs = useMemo(
    () => sortFluxJobs(
      jobs.filter(job =>
        filterByTab(job, activeTab) &&
        filterBySearch(job, search) &&
        filterByCriteria(job, filters, statusContext)
      ),
      sortColumn,
      sortDirection,
    ),
    [jobs, activeTab, search, filters, statusContext, sortColumn, sortDirection],
  );

  // Tab counts: recalculated based on current search, filters, and job state
  const tabCounts = useMemo(
    () => computeTabCounts(jobs, search, filters, statusContext),
    [jobs, search, filters, statusContext],
  );

  // Focused job ID for visual highlight (Alt+↑/↓)
  const focusedJobId = focusedRowIndex >= 0 && focusedRowIndex < filteredJobs.length
    ? filteredJobs[focusedRowIndex]!.id
    : undefined;

  // ── Callbacks ─────────────────────────────────────────────────────────────

  const handleTabChange = useCallback((tab: typeof activeTab) => {
    setFocusedRowIndex(-1);
    navigate(tabToPathname(tab));
  }, [navigate]);

  const handleSearchChange = useCallback((value: string) => {
    setFocusedRowIndex(-1);
    setSearch(value);
  }, []);

  const handleFiltersChange = useCallback((next: FluxFilters) => {
    setFocusedRowIndex(-1);
    setFilters(next);
  }, []);

  const handleNewJob = useCallback(() => {
    navigate('/stations/job/new', { state: { from: location.pathname } });
  }, [navigate, location.pathname]);

  /**
   * Update an outsourced task's ST status and persist to the backend (v0.5.23).
   * Uses RTK Query mutation with invalidatesTags: refetches jobs on success.
   */
  const handleUpdateSTStatus = useCallback((taskId: string, status: FluxSTStatus) => {
    if (!canEditFluxReality) {
      showToast('Bascule en mode Prod pour modifier le statut ST.', 'info');
      return;
    }
    void updateSTStatus({ taskId, status });
  }, [updateSTStatus, canEditFluxReality, showToast]);

  /**
   * Update a single element's prerequisite status and persist to the backend.
   *
   * Uses RTK Query mutation with optimistic update: the cache is updated
   * immediately via onQueryStarted, and reverted automatically on API error.
   * (qa.md K8.1, v0.5.19)
   */
  const handleUpdatePrerequisite = useCallback((
    jobId: string,
    elementId: string,
    column: PrerequisiteColumn,
    status: PrerequisiteStatus,
  ) => {
    if (!canEditFluxReality) {
      showToast('Bascule en mode Prod pour valider les prérequis.', 'info');
      return;
    }
    void updateElementPrerequisite({ jobId, elementId, column, value: status });
  }, [updateElementPrerequisite, canEditFluxReality, showToast]);

  /**
   * Update a job's shipper (transporteur) and persist to the backend.
   * Uses RTK Query mutation with optimistic update.
   */
  const handleUpdateShipper = useCallback((jobInternalId: string, shipperId: string | null) => {
    void updateJobShipper({ jobInternalId, shipperId });
  }, [updateJobShipper]);

  /** Toggle a job's shipped (Parti) status. */
  const handleToggleShipped = useCallback((jobInternalId: string, shipped: boolean) => {
    if (!canEditFluxReality) {
      showToast('Bascule en mode Prod pour cocher Parti.', 'info');
      return;
    }
    void toggleJobShipped({ jobInternalId, shipped });
  }, [toggleJobShipped, canEditFluxReality, showToast]);

  /** Toggle a job's invoiced (Facturé) status. */
  const handleToggleInvoiced = useCallback((jobInternalId: string, invoiced: boolean) => {
    if (!canEditFluxReality) {
      showToast('Bascule en mode Prod pour cocher Facturé.', 'info');
      return;
    }
    void toggleJobInvoiced({ jobInternalId, invoiced });
  }, [toggleJobInvoiced, canEditFluxReality, showToast]);

  const handleUpdatePriority = useCallback((jobInternalId: string, deadlinePriority: number) => {
    if (!canEditFluxReality) {
      showToast('Bascule en mode Prod pour modifier la priorité.', 'info');
      return;
    }
    void updateJobPriority({ jobInternalId, deadlinePriority });
  }, [updateJobPriority, canEditFluxReality, showToast]);

  /** Toggle expanded state for a multi-element job. */
  const handleToggleExpand = useCallback((jobId: string) => {
    setExpandedJobIds(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  }, []);

  /** Open the delete confirmation dialog for a job. */
  const handleDeleteJob = useCallback((jobId: string) => {
    setDeleteConfirmJobId(jobId);
  }, []);

  /** Confirm deletion: call API, optimistically remove from cache, revert on error. */
  const handleConfirmDelete = useCallback(async () => {
    if (deleteConfirmJobId) {
      const fluxJob = jobs.find(j => j.id === deleteConfirmJobId);
      const internalId = fluxJob?.internalId;
      if (!internalId) {
        setDeleteConfirmJobId(null);
        return;
      }

      // Optimistic cache removal (returns patchResult with .undo())
      const patchResult = dispatch(
        fluxApi.util.updateQueryData('getFluxJobs', undefined, (draft) => {
          const idx = draft.findIndex((j) => j.id === deleteConfirmJobId);
          if (idx !== -1) draft.splice(idx, 1);
        }),
      );
      setExpandedJobIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteConfirmJobId);
        return next;
      });
      setFocusedRowIndex(-1);

      try {
        await deleteJob(internalId).unwrap();
      } catch {
        patchResult.undo();
        dispatch(setError({ status: 500, message: 'Erreur lors de la suppression du job.' }));
      }
    }
    setDeleteConfirmJobId(null);
  }, [deleteConfirmJobId, dispatch, jobs, deleteJob]);

  /** Navigate to the scheduler scrolled to the clicked task (F9). */
  const handleStationClick = useCallback((taskId: string) => {
    navigate(`/?task=${encodeURIComponent(taskId)}`);
  }, [navigate]);

  /**
   * Open the Pillar B JCF modification modal for a job. Préprod-only :
   * the surface is hidden in Prod via `canEditJobShape`. The legacy
   * "open JCF creation form in edit mode" navigation is gone — the
   * dedicated modification modal now handles deadline/sequence/gates
   * with continuous progress preserved (see Pillar B in
   * docs/architecture/preprod-prod-photo-model.md).
   */
  const handleEditJob = useCallback((jobId: string) => {
    if (!canEditJobShape) {
      showToast('Bascule en Préprod pour modifier un job.', 'info');
      return;
    }
    const fluxJob = jobs.find(j => j.id === jobId);
    const editId = fluxJob?.internalId;
    if (!editId) return;
    setEditingJobInternalId(editId);
  }, [jobs, canEditJobShape, showToast]);

  // ── Keyboard shortcuts (spec 3.4) ────────────────────────────────────────
  useEffect(() => {
    // When rendered as a backdrop behind JCF modal, suppress all keyboard shortcuts
    if (backdrop) return;

    const handler = (e: KeyboardEvent) => {
      detectKeyboardLayout(e);

      if (isAltLetter(e, 'f')) {
        e.preventDefault();
        if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.select();
        } else {
          searchInputRef.current?.focus();
        }
        return;
      }
      if (isAltLetter(e, 'n')) {
        e.preventDefault();
        if (!canEditJobShape) {
          showToast('Bascule en Préprod pour créer un job.', 'info');
          return;
        }
        navigate('/stations/job/new', { state: { from: location.pathname } });
        return;
      }

      if (!e.altKey) return;
      switch (e.code) {
        case 'ArrowRight': {
          e.preventDefault();
          const currentIndex = TAB_IDS.indexOf(activeTab);
          const nextTab = TAB_IDS[(currentIndex + 1) % TAB_IDS.length]!;
          navigate(tabToPathname(nextTab));
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const currentIndex = TAB_IDS.indexOf(activeTab);
          const prevTab = TAB_IDS[(currentIndex - 1 + TAB_IDS.length) % TAB_IDS.length]!;
          navigate(tabToPathname(prevTab));
          break;
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [activeTab, navigate, location.pathname, backdrop, canEditJobShape, showToast]);

  // ── Loading / error states ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-flux-base" data-testid="flux-loading" role="status" aria-live="polite">
        <div className="p-4 h-full relative">
          <div className="bg-flux-elevated rounded-lg border border-flux-border h-full overflow-hidden flex flex-col">
            {/* Toolbar skeleton */}
            <div className="px-4 py-3 flex items-center gap-3 border-b border-flux-border">
              <div className="h-5 w-32 rounded bg-flux-border animate-pulse" />
              <div className="h-8 flex-1 max-w-[400px] rounded bg-flux-border animate-pulse" />
              <div className="ml-auto h-8 w-24 rounded bg-flux-border animate-pulse" />
            </div>
            {/* Tab bar skeleton */}
            <div className="px-4 py-2 flex gap-4 border-b border-flux-border">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="h-4 rounded bg-flux-border animate-pulse" style={{ width: `${60 + i * 12}px`, animationDelay: `${i * 100}ms` }} />
              ))}
            </div>
            {/* Header row skeleton — mimics real table columns */}
            <div className="px-2 py-2 grid grid-cols-[2rem_2rem_2.5rem_6rem_1fr_1fr_5rem_4rem_3rem_3rem_3rem_3rem_3rem_repeat(4,2.5rem)_4rem] gap-px border-b border-flux-border items-center">
              {Array.from({ length: 18 }, (_, i) => (
                <div key={i} className="h-3 mx-1 rounded bg-flux-border animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
              ))}
            </div>
            {/* Row skeletons — same grid */}
            <div className="flex-1 overflow-hidden">
              {Array.from({ length: 14 }, (_, i) => (
                <div key={i} className="px-2 py-2.5 grid grid-cols-[2rem_2rem_2.5rem_6rem_1fr_1fr_5rem_4rem_3rem_3rem_3rem_3rem_3rem_repeat(4,2.5rem)_4rem] gap-px border-b border-flux-border/50 items-center">
                  <div className="h-3 mx-1 rounded bg-flux-border/60 animate-pulse" style={{ animationDelay: `${i * 40}ms` }} />
                  <div className="h-2.5 w-2.5 mx-auto rounded-full bg-flux-border/60 animate-pulse" style={{ animationDelay: `${i * 40 + 20}ms` }} />
                  <div className="h-3 mx-1 rounded bg-flux-border/60 animate-pulse" />
                  <div className="h-3 mx-1 rounded bg-flux-border/60 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
                  <div className="h-3 mx-1 rounded bg-flux-border/60 animate-pulse" style={{ width: `${60 + (i % 4) * 15}%`, animationDelay: `${i * 50}ms` }} />
                  <div className="h-3 mx-1 rounded bg-flux-border/60 animate-pulse" style={{ width: `${50 + (i % 3) * 20}%`, animationDelay: `${i * 50 + 30}ms` }} />
                  <div className="h-3 mx-1 rounded bg-flux-border/60 animate-pulse" />
                  <div className="h-3 mx-1 rounded bg-flux-border/60 animate-pulse" />
                  {Array.from({ length: 5 }, (_, j) => (
                    <div key={j} className="h-4 w-4 mx-auto rounded-full bg-flux-border/60 animate-pulse" style={{ animationDelay: `${(i * 5 + j) * 30}ms` }} />
                  ))}
                  {Array.from({ length: 4 }, (_, j) => (
                    <div key={`s${j}`} className="h-3 mx-1 rounded bg-flux-border/40 animate-pulse" />
                  ))}
                  <div className="h-3 mx-1 rounded bg-flux-border/60 animate-pulse" />
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
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex items-center justify-center bg-flux-base" data-testid="flux-error">
        <p className="text-red-400 text-sm">Erreur de chargement des jobs.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-flux-base" data-testid="flux-page">
      {/* Table area — toolbar + tabs + table inside the card */}
      <div className="flex-1 overflow-hidden">
        <div className="p-4 h-full">
          <div className="bg-flux-elevated rounded-lg border border-flux-border h-full overflow-hidden flex flex-col">
            {/* Toolbar: title + search bar + filter bar */}
            <FluxToolbar
              searchValue={search}
              onSearchChange={handleSearchChange}
              onNewJob={handleNewJob}
              canCreateJob={canEditJobShape}
              scenarioMode={mode}
              searchInputRef={searchInputRef}
              jobs={jobs}
              filters={filters}
              onFiltersChange={handleFiltersChange}
              advancementMode={advancementMode}
              onAdvancementModeChange={setAdvancementMode}
            />

            {/* Tab bar */}
            <FluxTabBar
              tabs={TAB_IDS.map(id => ({ key: id, label: TAB_LABELS[id] }))}
              activeTab={activeTab}
              counts={tabCounts}
              onTabChange={handleTabChange}
              ariaLabel="Filtres du tableau de flux"
            />

            {/* Table — fills remaining height */}
            <div className="flex-1 overflow-hidden">
            <FluxTable
              jobs={filteredJobs}
              categories={sortedCategories}
              focusedJobId={focusedJobId}
              expandedJobIds={expandedJobIds}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSortChange={handleSortChange}
              onUpdatePriority={handleUpdatePriority}
              onUpdatePrerequisite={handleUpdatePrerequisite}
              onUpdateSTStatus={handleUpdateSTStatus}
              onToggleExpand={handleToggleExpand}
              onDeleteJob={handleDeleteJob}
              onEditJob={handleEditJob}
              canEditJobShape={canEditJobShape}
              canEditWall={canEditFluxReality}
              onUpdateShipper={handleUpdateShipper}
              shippers={shippers}
              onToggleShipped={handleToggleShipped}
              onToggleInvoiced={handleToggleInvoiced}
              onStationClick={handleStationClick}
              lateJobIds={lateJobIds}
              conflictJobIds={conflictJobIds}
              advancementMode={advancementMode}
              onSetTaskCompletion={handleSetTaskCompletion}
              snapshot={snapshot ?? null}
            />
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirmJobId && (
        <FluxDeleteConfirmDialog
          onCancel={() => setDeleteConfirmJobId(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {/* Pillar B JCF modification modal — Préprod-only entry point. */}
      {editingJobInternalId && (
        <JobModificationContainer
          jobInternalId={editingJobInternalId}
          onClose={() => setEditingJobInternalId(null)}
        />
      )}

      <ShortcutFooter mode="flux" />
    </div>
  );
}
