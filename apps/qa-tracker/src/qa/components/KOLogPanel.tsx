/**
 * KO Log Panel Component
 *
 * Bug tracker panel for KO (failure) reports.
 * - Compact log entries with left severity accent bar
 * - Hover-reveal actions (close/reopen, delete)
 * - Auto-growing description textarea
 * - Discreet radio-dot severity selector
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
  useCreateKOLogMutation,
  useGetContentQuery,
  useGetKOLogsQuery,
  useResolveKOLogMutation,
  useReopenKOLogMutation,
  useDeleteKOLogMutation,
} from '../store/qaApi';
import { useAppSelector } from '@/store';
import {
  selectSelectedFolder,
  selectSelectedFile,
  selectSelectedTestId,
} from '../store/qaSlice';
import type { KOLogEntry } from '../types';

type Severity = 'blocker' | 'major' | 'minor';

const severityAccent: Record<Severity, string> = {
  blocker: 'border-l-red-500',
  major: 'border-l-orange-500',
  minor: 'border-l-yellow-500',
};

const severityDot: Record<Severity, string> = {
  blocker: 'bg-red-500',
  major: 'bg-orange-500',
  minor: 'bg-yellow-500',
};

function KOLogItem({
  entry,
  onResolve,
  onReopen,
  onDelete,
}: {
  entry: KOLogEntry;
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isOpen = !entry.resolvedAt;
  const date = new Date(entry.createdAt).toLocaleDateString('hu-HU', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      className={cn(
        'group border-l-[3px] pl-2.5 pr-1 py-1.5 rounded-r-sm transition-colors',
        severityAccent[entry.severity],
        isOpen
          ? 'hover:bg-zinc-800/50'
          : 'opacity-50 hover:opacity-70'
      )}
    >
      <div className="flex items-start gap-2">
        {/* Description + date */}
        <p
          className={cn(
            'flex-1 text-[13px] leading-snug',
            isOpen ? 'text-zinc-300' : 'text-zinc-500'
          )}
        >
          {entry.description}
          <span className="text-[11px] text-zinc-600 ml-2">{date}</span>
        </p>

        {/* Actions — visible on hover */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {isOpen ? (
            <button
              onClick={() => onResolve(entry.id)}
              title="Close"
              className="p-1 rounded text-zinc-500 hover:text-emerald-400 hover:bg-emerald-600/10 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => onReopen(entry.id)}
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

export function KOLogPanel() {
  const selectedFolder = useAppSelector(selectSelectedFolder);
  const selectedFile = useAppSelector(selectSelectedFile);
  const selectedTestId = useAppSelector(selectSelectedTestId);

  const { data: content } = useGetContentQuery(
    { folder: selectedFolder!, file: selectedFile! },
    { skip: !selectedFolder || !selectedFile }
  );

  const test = content?.tests.find((t) => t.fullId === selectedTestId);

  const { data: koLogs } = useGetKOLogsQuery(selectedTestId ?? undefined, {
    skip: !selectedTestId,
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Severity>('major');
  const [createKOLog, { isLoading: isCreating }] = useCreateKOLogMutation();
  const [resolveKOLog] = useResolveKOLogMutation();
  const [reopenKOLog] = useReopenKOLogMutation();
  const [deleteKOLog] = useDeleteKOLogMutation();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  // Auto-expand when a result is KO or existing KO logs exist
  const hasKOResult = test?.statusEntry.results
    ? Object.values(test.statusEntry.results).some((s) => s === 'ko')
    : false;
  const hasKOLogs = (koLogs?.length ?? 0) > 0;

  useEffect(() => {
    if (hasKOResult || hasKOLogs) {
      setIsExpanded(true);
    }
  }, [hasKOResult, hasKOLogs]);

  const openCount = koLogs?.filter((l) => !l.resolvedAt).length ?? 0;
  const totalCount = koLogs?.length ?? 0;

  // Sort: open first, then by date descending
  const sortedLogs = koLogs
    ? [...koLogs].sort((a, b) => {
        const aOpen = !a.resolvedAt;
        const bOpen = !b.resolvedAt;
        if (aOpen !== bOpen) return aOpen ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
    : [];

  const handleSubmit = async () => {
    if (!test || !description.trim()) return;

    await createKOLog({
      testId: test.fullId,
      description: description.trim(),
      severity,
    });

    setDescription('');
    // Reset textarea height after clearing
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const isDisabled = !test || !description.trim() || isCreating;

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
        KO Log
        {hasKOLogs && (
          openCount > 0 ? (
            <span className="ml-1 text-[10px] font-mono bg-red-600/20 text-red-400 border border-red-600/30 rounded px-1.5 py-0.5 normal-case tracking-normal">
              {openCount} open
            </span>
          ) : (
            <span className="ml-1 text-[10px] font-mono bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 rounded px-1.5 py-0.5 normal-case tracking-normal">
              {totalCount} resolved
            </span>
          )
        )}
      </button>

      {isExpanded && (
        <>
          {/* KO entries list */}
          {sortedLogs.length > 0 && (
            <div className="flex flex-col gap-0.5 mb-4">
              {sortedLogs.map((entry) => (
                <KOLogItem
                  key={entry.id}
                  entry={entry}
                  onResolve={(id) => resolveKOLog(id)}
                  onReopen={(id) => reopenKOLog(id)}
                  onDelete={(id) => deleteKOLog(id)}
                />
              ))}
            </div>
          )}

          {/* New report form */}
          <div className="flex flex-col gap-2">
            <textarea
              ref={textareaRef}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                autoResize();
              }}
              placeholder="Describe the bug..."
              rows={2}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-500 resize-none overflow-hidden leading-relaxed"
            />

            {/* Severity radio + submit row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {(['blocker', 'major', 'minor'] as Severity[]).map((s) => (
                  <label
                    key={s}
                    className="flex items-center gap-1.5 cursor-pointer select-none"
                    onClick={() => setSeverity(s)}
                  >
                    <span
                      className={cn(
                        'w-2.5 h-2.5 rounded-full border-2 transition-colors',
                        severity === s
                          ? `${severityDot[s]} border-transparent`
                          : 'border-zinc-600 bg-transparent'
                      )}
                    />
                    <span
                      className={cn(
                        'text-[12px] transition-colors',
                        severity === s ? 'text-zinc-300' : 'text-zinc-500'
                      )}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </span>
                  </label>
                ))}
              </div>

              <button
                onClick={handleSubmit}
                disabled={isDisabled}
                className={cn(
                  'px-4 py-1.5 rounded text-[12px] font-medium transition-colors',
                  isDisabled
                    ? 'bg-zinc-700/50 text-zinc-600 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                )}
              >
                {isCreating ? 'Logging...' : 'Log KO'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
