/**
 * Test Viewer Component
 *
 * Displays the selected test details:
 * - Test ID and title
 * - Fixture link
 * - Preconditions
 * - Steps
 * - Expected results with OK/KO buttons
 */

import { useState } from 'react';
import { ExternalLink, FileEdit } from 'lucide-react';
import { useGetContentQuery, useUpdateStatusMutation } from '../store/qaApi';
import { useAppSelector } from '@/store';
import {
  selectSelectedFolder,
  selectSelectedFile,
  selectSelectedTestId,
} from '../store/qaSlice';
import { ExpectedResultItem } from './ExpectedResultItem';
import { StatusBadge } from './StatusBadge';
import { KOLogPanel } from './KOLogPanel';
import { FixtureNotesPanel } from './FixtureNotesPanel';
import { MarkdownEditorModal } from './MarkdownEditorModal';
import type { ResultStatus } from '../types';

const SCHEDULER_URL = import.meta.env.VITE_SCHEDULER_URL || 'http://localhost:5173';

export function TestViewer() {
  const selectedFolder = useAppSelector(selectSelectedFolder);
  const selectedFile = useAppSelector(selectSelectedFile);
  const selectedTestId = useAppSelector(selectSelectedTestId);
  const [updateStatus] = useUpdateStatusMutation();
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const { data: content } = useGetContentQuery(
    { folder: selectedFolder!, file: selectedFile! },
    { skip: !selectedFolder || !selectedFile }
  );

  const test = content?.tests.find((t) => t.fullId === selectedTestId);

  if (!test) {
    return null;
  }

  const handleResultStatusChange = async (
    resultIndex: number,
    status: ResultStatus
  ) => {
    await updateStatus({
      testId: test.fullId,
      resultIndex,
      status,
    });
  };

  // Find fixture URL from content fixtures
  const fixtureInfo = test.fixture
    ? content?.fixtures.find((f) => f.name === test.fixture)
    : null;

  // Resolve fixture URL: relative URLs (e.g. "?fixture=x") → scheduler origin
  const fixtureHref = (() => {
    const raw = fixtureInfo?.url;
    if (!raw) return `${SCHEDULER_URL}/?fixture=${test.fixture}`;
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    // Relative URL → prepend scheduler origin
    return `${SCHEDULER_URL}/${raw.replace(/^\//, '')}`;
  })();

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-zinc-100">
              {test.id}
            </h2>
            <StatusBadge status={test.statusEntry.status} />
          </div>
          <button
            onClick={() => setIsEditorOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded text-base transition-colors"
          >
            <FileEdit className="w-4 h-4" />
            Edit MD
          </button>
        </div>
        <p className="text-zinc-300">{test.title}</p>
        {test.scenario && (
          <p className="text-base text-zinc-400 mt-1">
            Scenario: {test.scenario}
          </p>
        )}
      </div>

      {/* Fixture link */}
      {(test.fixture || fixtureInfo) && (
        <div className="mb-6">
          <h3 className="text-base font-semibold text-zinc-500 uppercase tracking-wide mb-2">
            Fixture
          </h3>
          <a
            href={fixtureHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-base text-blue-400 hover:text-blue-300 transition-colors"
          >
            <code className="bg-zinc-800 px-2 py-0.5 rounded">
              {test.fixture}
            </code>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* Feature */}
      {test.feature && (
        <div className="mb-6">
          <h3 className="text-base font-semibold text-zinc-500 uppercase tracking-wide mb-2">
            Feature
          </h3>
          <p className="text-base text-zinc-300">{test.feature}</p>
        </div>
      )}

      {/* Preconditions */}
      {test.preconditions.length > 0 && (
        <div className="mb-6">
          <h3 className="text-base font-semibold text-zinc-500 uppercase tracking-wide mb-2">
            Preconditions
          </h3>
          <ul className="space-y-1">
            {test.preconditions.map((item, idx) => (
              <li key={idx} className="text-base text-zinc-300 flex items-start gap-2">
                <span className="text-zinc-500">-</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Steps */}
      {test.steps.length > 0 && (
        <div className="mb-6">
          <h3 className="text-base font-semibold text-zinc-500 uppercase tracking-wide mb-2">
            Steps
          </h3>
          <ol className="space-y-1">
            {test.steps.map((step, idx) => (
              <li key={idx} className="text-base text-zinc-300 flex items-start gap-2">
                <span className="text-zinc-500 shrink-0">{idx + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Expected Results */}
      <div className="mb-6">
        <h3 className="text-base font-semibold text-zinc-500 uppercase tracking-wide mb-3">
          Expected Results
        </h3>
        <div className="space-y-2">
          {test.expectedResults.map((result) => (
            <ExpectedResultItem
              key={result.index}
              result={result}
              status={test.statusEntry.results[result.index] || 'untested'}
              onStatusChange={(status) =>
                handleResultStatusChange(result.index, status)
              }
            />
          ))}
        </div>
      </div>

      {/* Inline panels */}
      <div className="border-t border-zinc-700 -mx-6 px-6 pt-4">
        <KOLogPanel />
        <FixtureNotesPanel />
      </div>

      {/* Markdown Editor Modal */}
      {selectedFolder && selectedFile && (
        <MarkdownEditorModal
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          folder={selectedFolder}
          file={selectedFile}
        />
      )}
    </div>
  );
}
