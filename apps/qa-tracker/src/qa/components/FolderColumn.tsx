/**
 * Folder Column Component
 *
 * Lists QA folders (scheduler, jcf, api) with progress bars.
 */

import { cn } from '@/utils/cn';
import { useGetFoldersQuery } from '../store/qaApi';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectSelectedFolder, setSelectedFolder } from '../store/qaSlice';
import { ProgressBar } from './ProgressBar';

interface FolderColumnProps {
  className?: string;
}

export function FolderColumn({ className }: FolderColumnProps) {
  const dispatch = useAppDispatch();
  const selectedFolder = useAppSelector(selectSelectedFolder);
  const { data: folders, isLoading, error } = useGetFoldersQuery();

  return (
    <div className={cn('flex flex-col h-full bg-zinc-900', className)}>
      <div className="px-3 py-2 border-b border-zinc-800">
        <h2 className="text-base font-semibold text-zinc-400 uppercase tracking-wide">
          Folders
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-3 text-base text-zinc-500">Loading...</div>
        )}
        {error && (
          <div className="p-3 text-base text-red-400">Failed to load folders</div>
        )}
        {folders?.map((folder) => (
          <button
            key={folder.path}
            onClick={() => dispatch(setSelectedFolder(folder.name))}
            className={cn(
              'w-full text-left px-3 py-2 hover:bg-zinc-800 transition-colors',
              selectedFolder === folder.name && 'bg-zinc-800'
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-base font-medium text-zinc-200">
                {folder.name}/
              </span>
              <span className="text-base text-zinc-500">
                {folder.progress.percentage}%
              </span>
            </div>
            <ProgressBar progress={folder.progress} />
            <div className="text-base text-zinc-500 mt-1">
              {folder.fileCount} files
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
