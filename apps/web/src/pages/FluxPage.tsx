import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FluxTable } from '@/components/FluxTable';
import { FluxToolbar } from '@/components/FluxToolbar';
import { FluxTabBar } from '@/components/FluxTabBar';
import { FluxDeleteConfirmDialog } from '@/components/FluxTable/FluxDeleteConfirmDialog';
import { useGetFluxJobsQuery, useAppDispatch, fluxApi } from '@/store';
import type { PrerequisiteColumn, PrerequisiteStatus } from '@/components/FluxTable/fluxTypes';
import {
  computeTabCounts,
  filterBySearch,
  filterByTab,
  pathnameToTab,
  tabToPathname,
  TAB_IDS,
} from '@/components/FluxTable/fluxFilters';

/**
 * Production Flow Dashboard page (/flux, /flux/prepresse, etc.).
 * Spec: docs/production-flow-dashboard-spec/tableau-de-flux.md
 * v0.5.16: Tab filtering, full-text search, URL persistence, keyboard shortcuts.
 * v0.5.17: Prerequisite listbox, expand/collapse, delete confirmation, edit navigation.
 */
export function FluxPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = pathnameToTab(location.pathname);
  const dispatch = useAppDispatch();

  // ── API data (RTK Query cache as source of truth) ─────────────────────────
  const { data: jobs = [], isLoading, isError } = useGetFluxJobsQuery();

  // ── Local UI state (not tied to server data) ──────────────────────────────
  const [expandedJobIds, setExpandedJobIds] = useState<Set<string>>(new Set());
  const [deleteConfirmJobId, setDeleteConfirmJobId] = useState<string | null>(null);

  // ── Search / keyboard state ──────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filtered jobs: tab filter + search, ID ascending
  const filteredJobs = useMemo(
    () => jobs
      .filter(job => filterByTab(job, activeTab) && filterBySearch(job, search))
      .sort((a, b) => a.id.localeCompare(b.id)),
    [jobs, activeTab, search],
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
    navigate('/job/new');
  }, [navigate]);

  /** Immutable update of a single element's prerequisite status (qa.md K8.1). */
  const handleUpdatePrerequisite = useCallback((
    jobId: string,
    elementId: string,
    column: PrerequisiteColumn,
    status: PrerequisiteStatus,
  ) => {
    dispatch(
      fluxApi.util.updateQueryData('getFluxJobs', undefined, (draft) => {
        const job = draft.find((j) => j.id === jobId);
        if (job) {
          const el = job.elements.find((e) => e.id === elementId);
          if (el) el[column] = status;
        }
      }),
    );
  }, [dispatch]);

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

  /** Navigate to the job edit page (qa.md K6.2). */
  const handleEditJob = useCallback((jobId: string) => {
    navigate(`/job/${jobId}`);
  }, [navigate]);

  // ── Keyboard shortcuts (spec 3.4) ────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey) return;

      switch (e.key) {
        case 'f':
        case 'F': {
          e.preventDefault();
          if (document.activeElement === searchInputRef.current) {
            searchInputRef.current?.select();
          } else {
            searchInputRef.current?.focus();
          }
          break;
        }
        case 'n':
        case 'N': {
          e.preventDefault();
          navigate('/job/new');
          break;
        }
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
        case 'ArrowDown': {
          e.preventDefault();
          setFocusedRowIndex(prev =>
            prev < filteredJobs.length - 1 ? prev + 1 : prev,
          );
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setFocusedRowIndex(prev => (prev > 0 ? prev - 1 : 0));
          break;
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [activeTab, navigate, filteredJobs.length]);

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

      {/* Table area */}
      <div className="flex-1 overflow-hidden">
        <div className="p-4 h-full">
          <div className="bg-flux-elevated rounded-lg border border-flux-border h-full overflow-hidden">
            <FluxTable
              jobs={filteredJobs}
              focusedJobId={focusedJobId}
              expandedJobIds={expandedJobIds}
              onUpdatePrerequisite={handleUpdatePrerequisite}
              onToggleExpand={handleToggleExpand}
              onDeleteJob={handleDeleteJob}
              onEditJob={handleEditJob}
            />
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
    </div>
  );
}
