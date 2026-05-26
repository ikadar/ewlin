import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import type { KanbanColumnDef, PaperGroup } from '../../utils/paperKanban';

type SortKey = 'deadline' | 'client';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'deadline', label: 'Date de sortie' },
  { value: 'client', label: 'Client' },
];

export interface KanbanJob {
  jobUuid: string;
  jobNum: number;
  client: string;
  label: string;
  deadline: string | null;
  groups: PaperGroup[];
  leftmostColumn: string;
}

interface DragData {
  type: 'job' | 'group';
  jobUuid: string;
  elementIds: string[];
}

interface Props {
  title: string;
  columns: KanbanColumnDef[];
  jobs: KanbanJob[];
  sortKey: SortKey;
  onSortChange: (key: SortKey) => void;
  onDrop: (elementIds: string[], targetColumnId: string) => void;
  showQuantity?: boolean;
}

export function PrerequisKanbanBoard({ title, columns, jobs, sortKey, onSortChange, onDrop, showQuantity = true }: Props) {
  const dragRef = useRef<DragData | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((job) => {
      if (String(job.jobNum).includes(q)) return true;
      if (job.client.toLowerCase().includes(q)) return true;
      if (job.label.toLowerCase().includes(q)) return true;
      return job.groups.some((g) => g.paperLabel.toLowerCase().includes(q));
    });
  }, [jobs, search]);

  function cardKey(jobUuid: string, paperKey?: string): string {
    return paperKey ? `${jobUuid}::${paperKey}` : jobUuid;
  }

  function allElementIds(job: KanbanJob): string[] {
    return job.groups.flatMap((g) => g.elements.map((e) => e.elementId));
  }

  function groupElementIds(group: PaperGroup): string[] {
    return group.elements.map((e) => e.elementId);
  }

  function handleCardClick(e: React.MouseEvent, key: string) {
    if (e.shiftKey) {
      e.preventDefault();
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    } else {
      setSelectedKeys((prev) => (prev.size === 1 && prev.has(key) ? new Set() : new Set([key])));
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- deps cover the state collectSelectedIds reads
  const handleDragStart = useCallback((e: React.DragEvent, data: DragData, key: string) => {
    const isSelected = selectedKeys.has(key);
    if (isSelected && selectedKeys.size > 1) {
      const ids: string[] = [];
      for (const k of selectedKeys) {
        const sep = k.indexOf('::');
        if (sep === -1) {
          const job = filteredJobs.find((j) => j.jobUuid === k);
          if (job) ids.push(...job.groups.flatMap((g) => g.elements.map((el) => el.elementId)));
        } else {
          const jobUuid = k.slice(0, sep);
          const pk = k.slice(sep + 2);
          const group = filteredJobs.find((j) => j.jobUuid === jobUuid)?.groups.find((g) => g.paperKey === pk);
          if (group) ids.push(...group.elements.map((el) => el.elementId));
        }
      }
      dragRef.current = { type: 'job', jobUuid: '', elementIds: [...new Set(ids)] };
      const badge = document.createElement('div');
      badge.textContent = String(selectedKeys.size);
      Object.assign(badge.style, {
        position: 'fixed', left: '-9999px', top: '0',
        padding: '2px 8px', background: '#3b82f6', color: 'white',
        borderRadius: '4px', fontSize: '12px', fontWeight: '600',
      });
      document.body.appendChild(badge);
      e.dataTransfer.setDragImage(badge, 16, 12);
      setTimeout(() => badge.remove(), 0);
    } else {
      dragRef.current = data;
      if (!isSelected) setSelectedKeys(new Set());
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  }, [selectedKeys, filteredJobs]);

  const handleGroupDragStart = useCallback((e: React.DragEvent, data: DragData, key: string) => {
    e.stopPropagation();
    handleDragStart(e, data, key);
  }, [handleDragStart]);

  const handleDragOver = useCallback((e: React.DragEvent, col: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(col);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent, col: string) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOverCol((prev) => (prev === col ? null : prev));
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, col: string) => {
    e.preventDefault();
    setDragOverCol(null);
    const drag = dragRef.current;
    if (drag && drag.elementIds.length > 0) {
      onDrop(drag.elementIds, col);
    }
    dragRef.current = null;
    setSelectedKeys(new Set());
  }, [onDrop]);

  const handleDragEnd = useCallback(() => {
    setDragOverCol(null);
    dragRef.current = null;
  }, []);

  const hasSelection = selectedKeys.size > 0;
  useEffect(() => {
    if (!hasSelection) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target as HTMLElement)?.closest('[role=dialog]')) {
        setSelectedKeys(new Set());
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setSelectedKeys(new Set());
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [hasSelection]);

  function buildColumnContent(colId: string) {
    const jobCards: KanbanJob[] = [];
    const standaloneGroups: { group: PaperGroup; job: KanbanJob }[] = [];

    for (const job of filteredJobs) {
      const groupsHere = job.groups.filter((g) => g.column === colId);
      if (groupsHere.length === 0) continue;

      if (job.leftmostColumn === colId) {
        jobCards.push(job);
      } else {
        for (const g of groupsHere) {
          standaloneGroups.push({ group: g, job });
        }
      }
    }

    return { jobCards, standaloneGroups };
  }

  function renderJobCard(job: KanbanJob, colId: string) {
    const key = cardKey(job.jobUuid);
    const isSelected = selectedKeys.has(key);
    const groupsHere = job.groups.filter((g) => g.column === colId);
    const groupsAway = job.groups.filter((g) => g.column !== colId);
    const isSingleGroup = job.groups.length === 1 && groupsAway.length === 0;

    return (
      <div
        key={job.jobUuid}
        className={`bg-white/[0.015] border p-2.5 cursor-grab transition-colors ${
          isSelected ? 'border-blue-500/60 ring-1 ring-blue-500/40' : 'border-white/5 hover:border-white/10'
        }`}
        draggable
        onClick={(e) => handleCardClick(e, key)}
        onDragStart={(e) => handleDragStart(e, { type: 'job', jobUuid: job.jobUuid, elementIds: allElementIds(job) }, key)}
        onDragEnd={handleDragEnd}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-zinc-300 min-w-0 overflow-hidden">
            <span className="font-bold text-zinc-100 tabular-nums shrink-0">{job.jobNum}</span>
            <span className="shrink-0 max-w-[100px] truncate">{job.client}</span>
            <span className="truncate">{job.label}</span>
          </div>
        </div>

        {isSingleGroup ? (
          renderGroupBody(groupsHere[0])
        ) : (
          <div className="flex flex-col gap-1">
            {groupsHere.map((g) => renderGroupCard(g, job))}
            {groupsAway.map((g) => renderCutout(g))}
          </div>
        )}
      </div>
    );
  }

  function renderGroupBody(group: PaperGroup) {
    return (
      <div className="bg-white/[0.04] border-l-4 border-zinc-500 py-[7px] px-[11px] min-h-[32px] flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-medium text-zinc-200 truncate">{group.paperLabel}</span>
        {group.elements.length > 1 && (
          <span className="text-[9px] font-bold text-zinc-400 bg-white/5 border border-white/[0.08] rounded-[3px] px-1 shrink-0">
            &times;{group.elements.length} élt
          </span>
        )}
        {showQuantity && group.totalSheets > 0 && (
          <span className="text-[11px] text-zinc-400 font-mono tabular-nums shrink-0 ml-auto">
            {group.totalSheets.toLocaleString('fr-FR')} f.
          </span>
        )}
      </div>
    );
  }

  function renderGroupCard(group: PaperGroup, job: KanbanJob) {
    const key = cardKey(job.jobUuid, group.paperKey);
    const isSelected = selectedKeys.has(key);

    return (
      <div
        key={group.paperKey}
        className={`bg-white/[0.04] border-l-4 py-[7px] px-[11px] min-h-[32px] flex items-center justify-between gap-2 cursor-grab transition-all ${
          isSelected ? 'border-l-blue-500/60 ring-1 ring-blue-500/40' : 'border-zinc-500 hover:brightness-125'
        }`}
        draggable
        onClick={(e) => { e.stopPropagation(); handleCardClick(e, key); }}
        onDragStart={(e) =>
          handleGroupDragStart(e, { type: 'group', jobUuid: job.jobUuid, elementIds: groupElementIds(group) }, key)
        }
        onDragEnd={handleDragEnd}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[12.5px] font-medium text-zinc-200 truncate">{group.paperLabel}</span>
          {group.elements.length > 1 && (
            <span className="text-[9px] font-bold text-zinc-400 bg-white/5 border border-white/[0.08] rounded-[3px] px-1 shrink-0">
              &times;{group.elements.length} élt
            </span>
          )}
        </div>
        {showQuantity && group.totalSheets > 0 && (
          <span className="text-[11px] text-zinc-400 font-mono tabular-nums shrink-0">
            {group.totalSheets.toLocaleString('fr-FR')} f.
          </span>
        )}
      </div>
    );
  }

  function renderCutout(group: PaperGroup) {
    const col = columns.find((c) => c.id === group.column);
    return (
      <div
        key={group.paperKey}
        className="border border-dashed border-white/10 border-l-4 border-l-solid border-l-white/15 py-[6px] px-[11px] min-h-[32px] flex items-center gap-1.5 text-[11px] text-zinc-500"
        style={{
          background: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.012) 4px, rgba(255,255,255,0.012) 8px)',
        }}
      >
        <span className="opacity-85">{group.paperLabel}</span>
        {group.elements.length > 1 && <span>&times;{group.elements.length}</span>}
        <span
          className="ml-auto text-[9px] font-bold px-[5px] py-px rounded-[3px] border"
          style={col ? { color: col.dotColor, borderColor: `${col.dotColor}66`, backgroundColor: `${col.dotColor}26` } : undefined}
        >
          {col?.label}
        </span>
      </div>
    );
  }

  function renderStandalone(group: PaperGroup, job: KanbanJob) {
    const key = cardKey(job.jobUuid, group.paperKey);
    const isSelected = selectedKeys.has(key);

    return (
      <div
        key={`${job.jobUuid}-${group.paperKey}`}
        className={`bg-white/[0.015] border overflow-hidden cursor-grab transition-colors ${
          isSelected ? 'border-blue-500/60 ring-1 ring-blue-500/40' : 'border-white/5 hover:border-white/10'
        }`}
        draggable
        onClick={(e) => handleCardClick(e, key)}
        onDragStart={(e) =>
          handleGroupDragStart(e, { type: 'group', jobUuid: job.jobUuid, elementIds: groupElementIds(group) }, key)
        }
        onDragEnd={handleDragEnd}
      >
        <div className="px-[11px] py-1 flex items-center gap-1.5 text-[10.5px] text-zinc-500 mb-1 overflow-hidden">
          <span className="font-bold text-zinc-100 shrink-0">{job.jobNum}</span>
          <span className="shrink-0 max-w-[80px] truncate">{job.client}</span>
          <span className="truncate">{job.label}</span>
        </div>
        <div className="bg-white/[0.04] border-l-4 border-zinc-500 py-[7px] px-[11px] min-h-[32px] flex items-center justify-between gap-2 hover:brightness-125 transition-all">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[12.5px] font-medium text-zinc-200 truncate">{group.paperLabel}</span>
            {group.elements.length > 1 && (
              <span className="text-[9px] font-bold text-zinc-400 bg-white/5 border border-white/[0.08] rounded-[3px] px-1 shrink-0">
                &times;{group.elements.length} élt
              </span>
            )}
          </div>
          {showQuantity && group.totalSheets > 0 && (
            <span className="text-[11px] text-zinc-400 font-mono tabular-nums shrink-0">
              {group.totalSheets.toLocaleString('fr-FR')} f.
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-flux-base">
      <div className="border-b border-flux-border px-6 py-3.5 flex items-center gap-4 shrink-0">
        <h1 className="text-xl font-semibold text-flux-text-primary shrink-0">{title}</h1>
        {selectedKeys.size > 0 && (
          <span className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full font-medium tabular-nums">
            {selectedKeys.size} sélectionné{selectedKeys.size > 1 ? 's' : ''}
          </span>
        )}
        <div className="relative flex-1 max-w-[360px]">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-flux-text-tertiary pointer-events-none"
            strokeWidth={2}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-10 pr-4 py-1.5 text-sm bg-flux-hover border border-flux-border rounded-lg text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            data-testid="kanban-search"
            aria-label={`Rechercher dans ${title}`}
          />
        </div>
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <span className="text-sm text-flux-text-muted">Trier par</span>
          <SortSelect value={sortKey} onChange={onSortChange} />
        </div>
      </div>

      <div className="flex-1 flex gap-5 p-5 pb-10 overflow-x-auto min-h-0">
        {columns.map((col) => {
          const { jobCards, standaloneGroups } = buildColumnContent(col.id);
          const count = jobCards.length + standaloneGroups.length;

          return (
            <div key={col.id} className="flex-none w-[350px] flex flex-col bg-flux-surface rounded-[10px] border border-flux-border min-h-0">
              <div className="px-3.5 py-3 pb-2.5 flex items-center justify-between border-b border-flux-border shrink-0">
                <div className="text-sm font-semibold text-flux-text-primary flex items-center gap-2">
                  <span className="w-[7px] h-[7px] rounded-full" style={{ background: col.dotColor }} />
                  {col.label}
                </div>
                <span className="text-xs text-flux-text-muted bg-flux-elevated px-[7px] py-px rounded-full font-medium tabular-nums">
                  {count}
                </span>
              </div>

              <div
                className={`p-2 pb-6 overflow-y-auto flex-1 flex flex-col gap-2.5 min-h-[60px] transition-colors rounded-b-[10px] ${
                  dragOverCol === col.id ? 'bg-white/[0.035]' : ''
                }`}
                onClick={(e) => { if (e.target === e.currentTarget) setSelectedKeys(new Set()); }}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={(e) => handleDragLeave(e, col.id)}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                {jobCards.map((job) => renderJobCard(job, col.id))}
                {standaloneGroups.map(({ group, job }) => renderStandalone(group, job))}
                {count === 0 && (
                  <div className="flex-1 flex items-center justify-center text-xs text-zinc-600 italic">
                    Aucun job
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SortSelect({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, minWidth: 0 });

  const selected = SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0];

  const handleOpen = useCallback(() => {
    if (isOpen) { setIsOpen(false); return; }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 2, left: rect.left, minWidth: Math.max(rect.width, 140) });
    setActiveIndex(SORT_OPTIONS.findIndex((o) => o.value === value));
    setIsOpen(true);
  }, [isOpen, value]);

  const handleSelect = useCallback((v: SortKey) => {
    onChange(v);
    setIsOpen(false);
    triggerRef.current?.focus();
  }, [onChange]);

  useEffect(() => {
    if (!isOpen) return;
    const onMouse = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || dropdownRef.current?.contains(t)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', onMouse);
    return () => document.removeEventListener('mousedown', onMouse);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('[role=dialog]')) return;
      switch (e.key) {
        case 'Escape': setIsOpen(false); triggerRef.current?.focus(); break;
        case 'ArrowDown': e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, SORT_OPTIONS.length - 1)); break;
        case 'ArrowUp': e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); break;
        case 'Enter': e.preventDefault(); if (activeIndex >= 0) handleSelect(SORT_OPTIONS[activeIndex].value); break;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, activeIndex, handleSelect]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className="bg-flux-elevated text-flux-text-secondary border border-flux-border rounded-lg px-2.5 py-1 text-sm font-sans cursor-pointer flex items-center gap-1.5 hover:border-flux-border-light transition-colors"
      >
        <span className="truncate">{selected.label}</span>
        <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
      </button>
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-[3px] shadow-lg py-1 max-h-48 overflow-y-auto"
          style={{ top: pos.top, left: pos.left, minWidth: pos.minWidth }}
        >
          {SORT_OPTIONS.map((opt, idx) => (
            <button
              key={opt.value}
              type="button"
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-700 ${
                idx === activeIndex ? 'bg-zinc-700/50' : ''
              } ${value === opt.value ? 'text-zinc-100 font-medium' : 'text-zinc-400'}`}
              onClick={() => handleSelect(opt.value)}
              onMouseEnter={() => setActiveIndex(idx)}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
