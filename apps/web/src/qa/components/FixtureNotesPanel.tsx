/**
 * Fixture Notes Panel Component
 *
 * Always visible panel for fixture change requests.
 * - Displays current fixture description
 * - Textarea for notes/change requests
 * - Request Change button
 */

import { useState } from 'react';
import { cn } from '@/utils/cn';
import { useCreateFixtureRequestMutation, useGetContentQuery } from '../store/qaApi';
import { useAppSelector } from '@/store';
import {
  selectSelectedFolder,
  selectSelectedFile,
  selectSelectedTestId,
} from '../store/qaSlice';

export function FixtureNotesPanel() {
  const selectedFolder = useAppSelector(selectSelectedFolder);
  const selectedFile = useAppSelector(selectSelectedFile);
  const selectedTestId = useAppSelector(selectSelectedTestId);

  const { data: content } = useGetContentQuery(
    { folder: selectedFolder!, file: selectedFile! },
    { skip: !selectedFolder || !selectedFile }
  );

  const test = content?.tests.find((t) => t.fullId === selectedTestId);
  const fixtureInfo = test?.fixture
    ? content?.fixtures.find((f) => f.name === test.fixture)
    : null;

  const [notes, setNotes] = useState('');
  const [createRequest, { isLoading }] = useCreateFixtureRequestMutation();

  const handleSubmit = async () => {
    if (!test || !test.fixture || !notes.trim()) return;

    await createRequest({
      testId: test.fullId,
      fixture: test.fixture,
      currentNotes: fixtureInfo?.description || '',
      requestedChange: notes.trim(),
    });

    // Reset form
    setNotes('');
  };

  const isDisabled = !test || !test.fixture || !notes.trim() || isLoading;

  return (
    <div className="mb-6">
      <h3 className="text-base font-semibold text-zinc-500 uppercase tracking-wide mb-3">Fixture Notes</h3>

      {/* Current fixture description */}
      {fixtureInfo?.description && (
        <div className="mb-3 p-2 bg-zinc-800/50 rounded text-base text-zinc-400">
          <span className="font-medium">Current: </span>
          {fixtureInfo.description}
        </div>
      )}

      {!test?.fixture && (
        <div className="mb-3 p-2 bg-zinc-800/50 rounded text-base text-zinc-500">
          No fixture associated with this test
        </div>
      )}

      {/* Notes textarea */}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Describe current fixture state and desired changes..."
        disabled={!test?.fixture}
        className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-base text-zinc-200 placeholder:text-zinc-500 min-h-[80px] resize-none disabled:opacity-50"
      />

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={isDisabled}
        className={cn(
          'w-full mt-3 py-2 rounded text-base font-medium transition-colors',
          isDisabled
            ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        )}
      >
        {isLoading ? 'Submitting...' : 'Request Change'}
      </button>
    </div>
  );
}
