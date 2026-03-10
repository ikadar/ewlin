import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ShortcutFooter } from '@/components/ShortcutFooter/ShortcutFooter';
import { detectKeyboardLayout, isAltLetter } from '@/utils/keyboardLayout';
import { useLocation, useNavigate } from 'react-router-dom';
import { FluxTable } from '@/components/FluxTable';
import { FluxToolbar } from '@/components/FluxToolbar';
import { FluxTabBar } from '@/components/FluxTabBar';
import { FluxDeleteConfirmDialog } from '@/components/FluxTable/FluxDeleteConfirmDialog';
import { useGetFluxJobsQuery, useUpdateSTStatusMutation, useUpdateElementPrerequisiteMutation, useUpdateJobShipperMutation, useToggleJobShippedMutation, useGetShippersQuery, useAppDispatch, fluxApi } from '@/store';
import { useGetStationCategoriesQuery } from '@/store/api/stationCategoryApi';
import type { FluxSTStatus, PrerequisiteColumn, PrerequisiteStatus } from '@/components/FluxTable/fluxTypes';
import {
  computeTabCounts,
  filterBySearch,
  filterByTab,
  pathnameToTab,
  tabToPathname,
  TAB_IDS,
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
  const navigate = useNavigate();

  const activeTab = pathnameToTab(location.pathname);
  const dispatch = useAppDispatch();

  // ── API data (RTK Query cache as source of truth) ─────────────────────────
  const { data: jobs = [], isLoading: isJobsLoading, isError } = useGetFluxJobsQuery();
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
  const { data: shippers = [] } = useGetShippersQuery();

  // ── Local UI state (not tied to server data) ──────────────────────────────
  const [expandedJobIds, setExpandedJobIds] = useState<Set<string>>(new Set());
  const [deleteConfirmJobId, setDeleteConfirmJobId] = useState<string | null>(null);

  // ── Search / keyboard state ──────────────────────────────────────────────
  const [search, setSearch] = useState('');
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

  // Filtered + sorted jobs: tab filter → search → sort
  const filteredJobs = useMemo(
    () => sortFluxJobs(
      jobs.filter(job => filterByTab(job, activeTab) && filterBySearch(job, search)),
      sortColumn,
      sortDirection,
    ),
    [jobs, activeTab, search, sortColumn, sortDirection],
  );

  // Tab counts: all 5 tabs recalculated based on current search and job state
  const tabCounts = useMemo(
    () => computeTabCounts(jobs, search),
    [jobs, search],
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

  const handleNewJob = useCallback(() => {
    navigate('/job/new', { state: { from: location.pathname } });
  }, [navigate, location.pathname]);

  /**
   * Update an outsourced task's ST status and persist to the backend (v0.5.23).
   * Uses RTK Query mutation with invalidatesTags: refetches jobs on success.
   */
  const handleUpdateSTStatus = useCallback((taskId: string, status: FluxSTStatus) => {
    void updateSTStatus({ taskId, status });
  }, [updateSTStatus]);

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
    void updateElementPrerequisite({ jobId, elementId, column, value: status });
  }, [updateElementPrerequisite]);

  /**
   * Update a job's shipper (transporteur) and persist to the backend.
   * Uses RTK Query mutation with optimistic update.
   */
  const handleUpdateShipper = useCallback((jobInternalId: string, shipperId: string | null) => {
    void updateJobShipper({ jobInternalId, shipperId });
  }, [updateJobShipper]);

  /** Toggle a job's shipped (Parti) status. */
  const handleToggleShipped = useCallback((jobInternalId: string, shipped: boolean) => {
    void toggleJobShipped({ jobInternalId, shipped });
  }, [toggleJobShipped]);

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

  /** Confirm deletion: remove job from RTK Query cache, clear expanded state. */
  const handleConfirmDelete = useCallback(() => {
    if (deleteConfirmJobId) {
      dispatch(
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
    }
    setDeleteConfirmJobId(null);
  }, [deleteConfirmJobId, dispatch]);

  /** Open the scheduler in a new tab scrolled to the clicked task (F9). */
  const handleStationClick = useCallback((taskId: string) => {
    window.open(`/?task=${encodeURIComponent(taskId)}`, '_blank');
  }, []);

  /** Open JCF in edit mode for a job, then return to Flux on close (qa.md K6.2). */
  const handleEditJob = useCallback((jobId: string) => {
    // FluxJob.internalId is the scheduler Job UUID; FluxJob.id is the display reference.
    const fluxJob = jobs.find(j => j.id === jobId);
    const editId = fluxJob?.internalId ?? jobId;
    navigate('/job/new', { state: { editJobId: editId, from: location.pathname } });
  }, [navigate, location.pathname, jobs]);

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
        navigate('/job/new', { state: { from: location.pathname } });
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
  }, [activeTab, navigate, location.pathname, backdrop]);

  // ── Loading / error states ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-flux-base" data-testid="flux-loading">
        <p className="text-flux-text-muted text-sm">Chargement…</p>
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
            {/* Toolbar: title + search bar */}
            <FluxToolbar
              searchValue={search}
              onSearchChange={handleSearchChange}
              onNewJob={handleNewJob}
              searchInputRef={searchInputRef}
            />

            {/* Tab bar */}
            <FluxTabBar
              activeTab={activeTab}
              counts={tabCounts}
              onTabChange={handleTabChange}
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
              onUpdatePrerequisite={handleUpdatePrerequisite}
              onUpdateSTStatus={handleUpdateSTStatus}
              onToggleExpand={handleToggleExpand}
              onDeleteJob={handleDeleteJob}
              onEditJob={handleEditJob}
              onUpdateShipper={handleUpdateShipper}
              shippers={shippers}
              onToggleShipped={handleToggleShipped}
              onStationClick={handleStationClick}
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

      <ShortcutFooter mode="flux" />
    </div>
  );
}
