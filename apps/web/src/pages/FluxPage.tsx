import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FluxTable } from '@/components/FluxTable';
import { FluxToolbar } from '@/components/FluxToolbar';
import { FluxTabBar } from '@/components/FluxTabBar';
import { FLUX_STATIC_JOBS } from '@/mock/fluxStaticData';
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
 */
export function FluxPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = pathnameToTab(location.pathname);

  const [search, setSearch] = useState('');
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filtered jobs: tab filter + search, ID ascending
  const filteredJobs = useMemo(
    () => FLUX_STATIC_JOBS
      .filter(job => filterByTab(job, activeTab) && filterBySearch(job, search))
      .sort((a, b) => a.id.localeCompare(b.id)),
    [activeTab, search],
  );

  // Tab counts: all 5 tabs recalculated based on current search (qa.md K4.1)
  const tabCounts = useMemo(
    () => computeTabCounts(FLUX_STATIC_JOBS, search),
    [search],
  );

  // Focused job ID for visual highlight (Alt+↑/↓)
  const focusedJobId = focusedRowIndex >= 0 && focusedRowIndex < filteredJobs.length
    ? filteredJobs[focusedRowIndex]!.id
    : undefined;

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

  // Keyboard shortcuts (spec 3.4)
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
            <FluxTable jobs={filteredJobs} focusedJobId={focusedJobId} />
          </div>
        </div>
      </div>
    </div>
  );
}
