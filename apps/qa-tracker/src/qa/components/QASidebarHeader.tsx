import { ArrowLeft } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  selectSelectedFolder,
  selectSelectedFile,
  selectSelectedTestId,
  setSelectedFolder,
  setSelectedFile,
  setSelectedTestId,
} from '../store/qaSlice';

export function QASidebarHeader() {
  const dispatch = useAppDispatch();
  const selectedFolder = useAppSelector(selectSelectedFolder);
  const selectedFile = useAppSelector(selectSelectedFile);
  const selectedTestId = useAppSelector(selectSelectedTestId);

  // Determine current level for back navigation
  const level = selectedTestId ? 3 : selectedFile ? 2 : selectedFolder ? 1 : 0;

  const handleBack = () => {
    if (selectedTestId) {
      dispatch(setSelectedTestId(null));
    } else if (selectedFile) {
      dispatch(setSelectedFile(null));
    } else if (selectedFolder) {
      dispatch(setSelectedFolder(null));
    }
  };

  // Extract short test ID from fullId (e.g. "scheduler/file.md::DS-001" → "DS-001")
  const shortTestId = selectedTestId
    ? selectedTestId.slice(selectedTestId.indexOf('::') + 2)
    : null;

  return (
    <div className="px-2 py-1.5 border-b border-zinc-700">
      <div className="flex items-center gap-1 min-h-[24px]">
        {level > 0 && (
          <button
            onClick={handleBack}
            className="p-0.5 hover:bg-zinc-700 rounded transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-zinc-400" />
          </button>
        )}
        <div className="flex items-center gap-1 text-xs text-zinc-400 truncate min-w-0">
          {selectedFolder && (
            <button
              onClick={() => {
                dispatch(setSelectedFile(null));
                dispatch(setSelectedTestId(null));
              }}
              className="hover:text-zinc-200 transition-colors truncate"
            >
              {selectedFolder}
            </button>
          )}
          {selectedFile && (
            <>
              <span className="text-zinc-600">/</span>
              <button
                onClick={() => dispatch(setSelectedTestId(null))}
                className="hover:text-zinc-200 transition-colors truncate"
              >
                {selectedFile.replace('.md', '')}
              </button>
            </>
          )}
          {shortTestId && (
            <>
              <span className="text-zinc-600">/</span>
              <span className="text-zinc-200 font-medium truncate">{shortTestId}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
