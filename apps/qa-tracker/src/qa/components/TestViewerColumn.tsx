/**
 * Test Viewer Column Component
 *
 * Displays selected test details with inline panels (all scrollable together).
 */

import { TestViewer } from './TestViewer';
import { useAppSelector } from '@/store';
import { selectSelectedTestId } from '../store/qaSlice';

export function TestViewerColumn() {
  const selectedTestId = useAppSelector(selectSelectedTestId);

  return (
    <div className="h-full overflow-y-auto bg-zinc-950">
      {selectedTestId ? (
        <TestViewer />
      ) : (
        <div className="flex items-center justify-center h-full">
          <span className="text-base text-zinc-500">Select a test to view details</span>
        </div>
      )}
    </div>
  );
}
