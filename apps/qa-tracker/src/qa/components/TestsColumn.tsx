/**
 * Tests Column Component
 *
 * Lists tests in the selected file with priority summary and status indicators.
 */

import { cn } from '@/utils/cn';
import { useGetContentQuery } from '../store/qaApi';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  selectSelectedFolder,
  selectSelectedFile,
  selectSelectedTestId,
  setSelectedTestId,
} from '../store/qaSlice';
import { PrioritySummary } from './PrioritySummary';
import { StatusIcon } from './StatusIcon';
import type { Priority, TestScenarioWithStatus } from '../types';

interface TestsColumnProps {
  className?: string;
}

const priorityColors: Record<Priority, string> = {
  P1: 'text-red-400',
  P2: 'text-orange-400',
  P3: 'text-yellow-400',
  P4: 'text-blue-400',
  P5: 'text-zinc-400',
};

function sortByPriorityAndId(tests: TestScenarioWithStatus[]): TestScenarioWithStatus[] {
  const priorityOrder: Record<Priority, number> = { P1: 1, P2: 2, P3: 3, P4: 4, P5: 5 };
  return [...tests].sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return a.id.localeCompare(b.id);
  });
}

export function TestsColumn({ className }: TestsColumnProps) {
  const dispatch = useAppDispatch();
  const selectedFolder = useAppSelector(selectSelectedFolder);
  const selectedFile = useAppSelector(selectSelectedFile);
  const selectedTestId = useAppSelector(selectSelectedTestId);

  const { data: content, isLoading, error } = useGetContentQuery(
    { folder: selectedFolder!, file: selectedFile! },
    { skip: !selectedFolder || !selectedFile }
  );

  if (!selectedFolder || !selectedFile) {
    return (
      <div className={cn('flex flex-col h-full bg-zinc-900', className)}>
        <div className="px-3 py-2 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-400 uppercase tracking-wide">
            Tests
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-base text-zinc-500">Select a theme</span>
        </div>
      </div>
    );
  }

  const sortedTests = content ? sortByPriorityAndId(content.tests) : [];

  // Calculate by-priority progress
  const byPriority = content?.tests.reduce(
    (acc, test) => {
      if (!acc[test.priority]) {
        acc[test.priority] = { total: 0, ok: 0, ko: 0, partial: 0, untested: 0 };
      }
      acc[test.priority].total++;
      acc[test.priority][test.statusEntry.status]++;
      return acc;
    },
    {} as Record<Priority, { total: number; ok: number; ko: number; partial: number; untested: number }>
  );

  return (
    <div className={cn('flex flex-col h-full min-h-0 bg-zinc-900', className)}>
      <div className="px-3 py-2 border-b border-zinc-800 shrink-0">
        <h2 className="text-base font-semibold text-zinc-400 uppercase tracking-wide">
          Tests
        </h2>
      </div>

      {byPriority && <div className="shrink-0"><PrioritySummary byPriority={byPriority} /></div>}

      <div className="flex-1 min-h-0 overflow-auto">
        {isLoading && (
          <div className="p-3 text-base text-zinc-500">Loading...</div>
        )}
        {error && (
          <div className="p-3 text-base text-red-400">Failed to load tests</div>
        )}
        {sortedTests.map((test) => (
          <button
            key={test.fullId}
            onClick={() => dispatch(setSelectedTestId(test.fullId))}
            className={cn(
              'w-full text-left px-3 py-2 hover:bg-zinc-800 transition-colors border-b border-zinc-800/50',
              selectedTestId === test.fullId && 'bg-zinc-800'
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn('text-base font-semibold', priorityColors[test.priority])}>
                {test.priority}
              </span>
              <span className="text-base font-medium text-zinc-200">
                {test.id}
              </span>
              <StatusIcon status={test.statusEntry.status} className="ml-auto" />
            </div>
            <div className="text-base text-zinc-400 mt-0.5 truncate">
              {test.scenario || test.title}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
