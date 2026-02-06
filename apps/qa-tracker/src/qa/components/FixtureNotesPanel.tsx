/**
 * Fixture Notes Panel Component
 *
 * Bug tracker-style panel for fixture change requests.
 * - Compact entries with left status accent bar
 * - Hover-reveal actions (implement/reject/reopen, delete)
 * - Auto-growing description textarea
 * - Auto-expands when pending requests exist
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Trash2,
  RotateCcw,
  Check,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  useCreateFixtureRequestMutation,
  useGetContentQuery,
  useGetFixtureRequestsQuery,
  useUpdateFixtureRequestStatusMutation,
  useDeleteFixtureRequestMutation,
} from '../store/qaApi';
import { useAppSelector } from '@/store';
import {
  selectSelectedFolder,
  selectSelectedFile,
  selectSelectedTestId,
} from '../store/qaSlice';
import type { FixtureRequest } from '../types';

type RequestStatus = FixtureRequest['status'];

const statusAccent: Record<RequestStatus, string> = {
  pending: 'border-l-blue-500',
  implemented: 'border-l-emerald-500',
  rejected: 'border-l-zinc-500',
};

function FixtureRequestItem({
  entry,
  onUpdateStatus,
  onDelete,
}: {
  entry: FixtureRequest;
  onUpdateStatus: (id: string, status: RequestStatus) => void;
  onDelete: (id: string) => void;
}) {
  const isPending = entry.status === 'pending';
  const date = new Date(entry.createdAt).toLocaleDateString('hu-HU', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      className={cn(
        'group border-l-[3px] pl-2.5 pr-1 py-1.5 rounded-r-sm transition-colors',
        statusAccent[entry.status],
        isPending
          ? 'hover:bg-zinc-800/50'
          : 'opacity-50 hover:opacity-70'
      )}
    >
      <div className="flex items-start gap-2">
        {/* Description + date */}
        <p
          className={cn(
            'flex-1 text-[13px] leading-snug',
            isPending ? 'text-zinc-300' : 'text-zinc-500'
          )}
        >
          {entry.requestedChange}
          <span className="text-[11px] text-zinc-600 ml-2">{date}</span>
        </p>

        {/* Actions — visible on hover */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {isPending ? (
            <>
              <button
                onClick={() => onUpdateStatus(entry.id, 'implemented')}
                title="Mark Implemented"
                className="p-1 rounded text-zinc-500 hover:text-emerald-400 hover:bg-emerald-600/10 transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDelete(entry.id)}
                title="Delete"
                className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-600/10 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          ) : (
            <button
              onClick={() => onUpdateStatus(entry.id, 'pending')}
              title="Reopen"
              className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => onDelete(entry.id)}
            title="Delete"
            className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-600/10 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

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

  const { data: fixtureRequests } = useGetFixtureRequestsQuery(
    selectedTestId ?? undefined,
    { skip: !selectedTestId }
  );

  const [isExpanded, setIsExpanded] = useState(false);
  const [notes, setNotes] = useState('');
  const [createRequest, { isLoading: isCreating }] = useCreateFixtureRequestMutation();
  const [updateStatus] = useUpdateFixtureRequestStatusMutation();
  const [deleteRequest] = useDeleteFixtureRequestMutation();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  // Auto-expand when pending requests exist
  const pendingCount = fixtureRequests?.filter((r) => r.status === 'pending').length ?? 0;
  const totalCount = fixtureRequests?.length ?? 0;
  const hasRequests = totalCount > 0;

  useEffect(() => {
    if (pendingCount > 0) {
      setIsExpanded(true);
    }
  }, [pendingCount]);

  // Sort: pending first, then by date descending
  const sortedRequests = fixtureRequests
    ? [...fixtureRequests].sort((a, b) => {
        const aPending = a.status === 'pending';
        const bPending = b.status === 'pending';
        if (aPending !== bPending) return aPending ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
    : [];

  const handleSubmit = async () => {
    if (!test || !test.fixture || !notes.trim()) return;

    await createRequest({
      testId: test.fullId,
      fixture: test.fixture,
      currentNotes: fixtureInfo?.description || '',
      requestedChange: notes.trim(),
    });

    setNotes('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const isDisabled = !test || !test.fixture || !notes.trim() || isCreating;

  return (
    <div className="mb-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-base font-semibold text-zinc-500 uppercase tracking-wide mb-3 hover:text-zinc-400 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
        Fixture Notes
        {hasRequests && (
          pendingCount > 0 ? (
            <span className="ml-1 text-[10px] font-mono bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded px-1.5 py-0.5 normal-case tracking-normal">
              {pendingCount} pending
            </span>
          ) : (
            <span className="ml-1 text-[10px] font-mono bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 rounded px-1.5 py-0.5 normal-case tracking-normal">
              {totalCount} done
            </span>
          )
        )}
      </button>

      {isExpanded && (
        <>
          {!test?.fixture && (
            <div className="mb-3 p-2 bg-zinc-800/50 rounded text-base text-zinc-500">
              No fixture associated with this test
            </div>
          )}

          {/* Fixture requests list */}
          {sortedRequests.length > 0 && (
            <div className="flex flex-col gap-0.5 mb-4">
              {sortedRequests.map((entry) => (
                <FixtureRequestItem
                  key={entry.id}
                  entry={entry}
                  onUpdateStatus={(id, status) => updateStatus({ id, status })}
                  onDelete={(id) => deleteRequest(id)}
                />
              ))}
            </div>
          )}

          {/* New request form */}
          <div className="flex flex-col gap-2">
            <textarea
              ref={textareaRef}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                autoResize();
              }}
              placeholder="Describe desired fixture changes..."
              rows={2}
              disabled={!test?.fixture}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-500 resize-none overflow-hidden leading-relaxed disabled:opacity-50"
            />

            <div className="flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={isDisabled}
                className={cn(
                  'px-4 py-1.5 rounded text-[12px] font-medium transition-colors',
                  isDisabled
                    ? 'bg-zinc-700/50 text-zinc-600 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                )}
              >
                {isCreating ? 'Submitting...' : 'Request Change'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
