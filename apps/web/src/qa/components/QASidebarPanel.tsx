import { useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store';
import {
  selectSelectedFolder,
  selectSelectedFile,
  selectSelectedTestId,
  setSelectedTestId,
} from '../store/qaSlice';
import { useGetContentQuery } from '../store/qaApi';
import { useQASidebarPreferences } from '../hooks/useQASidebarPreferences';
import { QASidebarHeader } from './QASidebarHeader';
import { FolderColumn } from './FolderColumn';
import { ThemeColumn } from './ThemeColumn';
import { TestsColumn } from './TestsColumn';
import { TestViewer } from './TestViewer';
const AUTO_COLLAPSE_WIDTH = 1200;

export function QASidebarPanel() {
  const dispatch = useAppDispatch();
  const { preferences, setCollapsed } = useQASidebarPreferences();
  const { isCollapsed, widthPercent } = preferences;

  // Derive drill-down level from Redux state
  const selectedFolder = useAppSelector(selectSelectedFolder);
  const selectedFile = useAppSelector(selectSelectedFile);
  const selectedTestId = useAppSelector(selectSelectedTestId);

  const level = selectedTestId ? 3 : selectedFile ? 2 : selectedFolder ? 1 : 0;

  // Content query — always runs when we have folder+file (no skip for collapsed)
  const { data: content } = useGetContentQuery(
    { folder: selectedFolder!, file: selectedFile! },
    { skip: !selectedFolder || !selectedFile }
  );

  // Test navigation data
  const tests = (level === 3 && content?.tests) ? content.tests : [];
  const currentIndex = tests.findIndex((t) => t.fullId === selectedTestId);
  const prevTest = currentIndex > 0 ? tests[currentIndex - 1] : null;
  const nextTest = currentIndex < tests.length - 1 ? tests[currentIndex + 1] : null;

  const goPrev = useCallback(() => {
    if (prevTest) dispatch(setSelectedTestId(prevTest.fullId));
  }, [prevTest, dispatch]);

  const goNext = useCallback(() => {
    if (nextTest) dispatch(setSelectedTestId(nextTest.fullId));
  }, [nextTest, dispatch]);

  // Auto-collapse on narrow screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < AUTO_COLLAPSE_WIDTH && !isCollapsed) {
        setCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCollapsed]);

  // Alt+P / Alt+N keyboard shortcuts for prev/next test
  useEffect(() => {
    if (isCollapsed || level !== 3) return;
    const handleKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.code === 'KeyP') { e.preventDefault(); goPrev(); }
      if (e.code === 'KeyN') { e.preventDefault(); goNext(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isCollapsed, level, goPrev, goNext]);

  return (
    <div
      className={`relative shrink-0 flex flex-col h-full bg-zinc-900 overflow-visible transition-[width] duration-200 ${
        isCollapsed ? 'w-0' : 'border-r border-zinc-700'
      }`}
      style={isCollapsed ? undefined : { width: `${widthPercent}%` }}
    >
      {/* Pull tab — always visible, sticks out from right edge */}
      <button
        onClick={() => setCollapsed(!isCollapsed)}
        className="absolute top-1/2 -translate-y-1/2 -right-5 z-10 w-5 h-14 flex items-center justify-center bg-zinc-800 border border-zinc-600 border-l-0 rounded-r-md hover:bg-zinc-700 transition-colors"
        title={isCollapsed ? 'Expand QA panel' : 'Collapse panel'}
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4 text-zinc-400" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-zinc-400" />
        )}
      </button>

      {/* Content — hidden by parent overflow when w-0 */}
      <div className={`flex flex-col h-full min-w-0 ${isCollapsed ? 'overflow-hidden' : ''}`}>
        <QASidebarHeader />

        <div className="flex-1 overflow-hidden">
          {level === 0 && <FolderColumn className="h-full" />}
          {level === 1 && <ThemeColumn className="h-full" />}
          {level === 2 && <TestsColumn className="h-full" />}
          {level === 3 && (
            <div className="h-full overflow-y-auto">
              <TestViewer />
            </div>
          )}
        </div>

        {/* Prev / Next navigation — always visible at bottom when viewing a test */}
        {level === 3 && tests.length > 1 && (
          <div className="shrink-0 border-t border-zinc-700 flex items-center justify-between px-4 py-3 bg-zinc-900">
            <button
              onClick={goPrev}
              disabled={!prevTest}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-25 disabled:cursor-not-allowed transition-colors text-zinc-200"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
              <kbd className="ml-1.5 text-[10px] font-mono text-zinc-500 border border-zinc-600 rounded px-1 py-0.5">Alt+P</kbd>
            </button>
            <span className="text-sm text-zinc-400 font-medium">
              {currentIndex + 1} / {tests.length}
            </span>
            <button
              onClick={goNext}
              disabled={!nextTest}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-25 disabled:cursor-not-allowed transition-colors text-zinc-200"
            >
              Next
              <ChevronRight className="w-4 h-4" />
              <kbd className="ml-1.5 text-[10px] font-mono text-zinc-500 border border-zinc-600 rounded px-1 py-0.5">Alt+N</kbd>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
