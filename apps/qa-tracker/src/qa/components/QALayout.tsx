/**
 * QA Layout Component
 *
 * 4-column grid layout:
 * - Column 1 (w-48): Folders with progress
 * - Column 2 (w-56): Themes/files with progress
 * - Column 3 (w-80): Tests list with priority summary
 * - Column 4 (flex-1): Test viewer with panels
 */

import { FolderColumn } from './FolderColumn';
import { ThemeColumn } from './ThemeColumn';
import { TestsColumn } from './TestsColumn';
import { TestViewerColumn } from './TestViewerColumn';

export function QALayout() {
  return (
    <div className="flex-1 grid grid-cols-[140px_160px_220px_1fr] h-full min-h-0">
      <FolderColumn className="border-r border-zinc-800" />
      <ThemeColumn className="border-r border-zinc-800" />
      <TestsColumn className="border-r border-zinc-800" />
      <TestViewerColumn />
    </div>
  );
}
