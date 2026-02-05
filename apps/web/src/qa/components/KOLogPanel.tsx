/**
 * KO Log Panel Component
 *
 * Always visible panel for logging KO (failure) details.
 * - Description field for bug comment
 * - Severity selection (blocker, major, minor)
 */

import { useState } from 'react';
import { cn } from '@/utils/cn';
import { useCreateKOLogMutation, useGetContentQuery } from '../store/qaApi';
import { useAppSelector } from '@/store';
import {
  selectSelectedFolder,
  selectSelectedFile,
  selectSelectedTestId,
} from '../store/qaSlice';

type Severity = 'blocker' | 'major' | 'minor';

export function KOLogPanel() {
  const selectedFolder = useAppSelector(selectSelectedFolder);
  const selectedFile = useAppSelector(selectSelectedFile);
  const selectedTestId = useAppSelector(selectSelectedTestId);

  const { data: content } = useGetContentQuery(
    { folder: selectedFolder!, file: selectedFile! },
    { skip: !selectedFolder || !selectedFile }
  );

  const test = content?.tests.find((t) => t.fullId === selectedTestId);

  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Severity>('major');
  const [createKOLog, { isLoading }] = useCreateKOLogMutation();

  const handleSubmit = async () => {
    if (!test || !description.trim()) return;

    await createKOLog({
      testId: test.fullId,
      description: description.trim(),
      severity,
    });

    // Reset form
    setDescription('');
  };

  const isDisabled = !test || !description.trim() || isLoading;

  return (
    <div className="mb-6">
      <h3 className="text-base font-semibold text-zinc-500 uppercase tracking-wide mb-3">KO Log</h3>

      {/* Description */}
      <div className="mb-3">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the bug..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-lg text-zinc-200 placeholder:text-zinc-500 min-h-[80px] resize-none"
        />
      </div>

      {/* Severity */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base text-zinc-400">Severity:</span>
        {(['blocker', 'major', 'minor'] as Severity[]).map((s) => (
          <button
            key={s}
            onClick={() => setSeverity(s)}
            className={cn(
              'px-3 py-1.5 text-base rounded transition-colors',
              severity === s
                ? s === 'blocker'
                  ? 'bg-red-600 text-white'
                  : s === 'major'
                  ? 'bg-orange-600 text-white'
                  : 'bg-yellow-600 text-white'
                : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
            )}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={isDisabled}
        className={cn(
          'w-full py-2 rounded text-base font-medium transition-colors',
          isDisabled
            ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
            : 'bg-red-600 hover:bg-red-700 text-white'
        )}
      >
        {isLoading ? 'Logging...' : 'Log KO'}
      </button>
    </div>
  );
}
