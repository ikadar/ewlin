/**
 * Theme Column Component
 *
 * Lists files in the selected folder with progress bars.
 */

import { cn } from '@/utils/cn';
import { useGetFilesQuery } from '../store/qaApi';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  selectSelectedFolder,
  selectSelectedFile,
  setSelectedFile,
} from '../store/qaSlice';
import { ProgressBar } from './ProgressBar';

interface ThemeColumnProps {
  className?: string;
}

export function ThemeColumn({ className }: ThemeColumnProps) {
  const dispatch = useAppDispatch();
  const selectedFolder = useAppSelector(selectSelectedFolder);
  const selectedFile = useAppSelector(selectSelectedFile);
  const { data: files, isLoading, error } = useGetFilesQuery(selectedFolder!, {
    skip: !selectedFolder,
  });

  if (!selectedFolder) {
    return (
      <div className={cn('flex flex-col h-full bg-zinc-900', className)}>
        <div className="px-3 py-2 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-400 uppercase tracking-wide">
            Themes
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-base text-zinc-500">Select a folder</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full bg-zinc-900', className)}>
      <div className="px-3 py-2 border-b border-zinc-800">
        <h2 className="text-base font-semibold text-zinc-400 uppercase tracking-wide">
          Themes
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-3 text-base text-zinc-500">Loading...</div>
        )}
        {error && (
          <div className="p-3 text-base text-red-400">Failed to load files</div>
        )}
        {files?.map((file) => (
          <button
            key={file.path}
            onClick={() => dispatch(setSelectedFile(file.name))}
            className={cn(
              'w-full text-left px-3 py-2 hover:bg-zinc-800 transition-colors',
              selectedFile === file.name && 'bg-zinc-800'
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-base font-medium text-zinc-200 truncate pr-2">
                {file.name.replace('.md', '')}
              </span>
              <span className="text-base text-zinc-500 shrink-0">
                {file.progress.percentage}%
              </span>
            </div>
            <ProgressBar progress={file.progress} />
            <div className="text-base text-zinc-500 mt-1">
              {file.testCount} tests
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
