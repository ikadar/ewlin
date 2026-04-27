/**
 * LogistiquePage — /logistique
 *
 * Operational view of the warehouse: incoming reception (sous-traitance returns)
 * and outgoing shipments (sous-traitance dispatch + client expedition).
 *
 * Phase 1.1 features (2026-04-27):
 *   - Date filter (Hier / Aujourd'hui / Demain / Cette semaine) — based on
 *     scheduledStart / scheduledEnd from the schedule snapshot, falls back to
 *     workshopExitDate for client expeditions.
 *   - Reliquat — overdue movements (scheduled < today, not processed) appear
 *     at the top of their column with a red accent bar + "Reliquat · Nj" badge,
 *     still cockable. The toolbar counter shows how many are visible.
 *   - Each check writes a LogisticsAudit (who/when), surfaced as tooltip.
 *   - Recently-completed movements (today) stay visible, dimmed.
 *   - "Voir le job complet" navigates to the scheduler with the job selected.
 */

import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRightToLine,
  ArrowRightFromLine,
  MessageSquare,
  Check,
  Pencil,
  X,
  AlertTriangle,
  ArrowRight,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import {
  useGetFluxJobsQuery,
  useUpdateSTStatusMutation,
  useToggleJobShippedMutation,
} from '../store/api/fluxApi';
import { useGetProvidersQuery } from '../store/api/providerApi';
import {
  useGetLogisticsNotesQuery,
  useCreateLogisticsNoteMutation,
  useDeleteLogisticsNoteMutation,
  useGetLatestLogisticsAuditsQuery,
  useCreateLogisticsAuditMutation,
} from '../store/api/logisticsApi';
import type {
  LogisticsNoteResponse,
  LogisticsAuditResponse,
  LogisticsRefType,
} from '../store/api/logisticsApi';
import { useGetSnapshotQuery } from '../store/api/scheduleApi';
import { useAppSelector } from '../store';
import { selectCurrentUser } from '../store/slices/authSlice';
import type { FluxJob, FluxSTStatus } from '../components/FluxTable/fluxTypes';
import type { TaskAssignment, Job as JobEntity } from '@flux/types';

// ============================================================================
// Movement model
// ============================================================================

type MovementType = 'st' | 'client';
type DateFilter = 'yesterday' | 'today' | 'tomorrow' | 'week';

interface Movement {
  id: string;
  kind: 'arrival' | 'departure';
  type: MovementType;
  refType: LogisticsRefType;
  refId: string;
  /** ISO datetime — when this movement is scheduled to physically occur */
  scheduledAt: Date | null;
  /** Display strings */
  time: string;
  title: string;
  subtitle: string;
  counterparty: string;
  jobRef: string;
  /** ST-only: status that drives the next transition on check */
  stStatus?: FluxSTStatus;
  /** Job UUID for the shipped toggle / job navigation */
  jobInternalId?: string;
  /** True when the movement has reached its final state (done / shipped).
   *  Displayed in green with a dimmed look but kept visible for tooltip /
   *  reversibility instead of being filtered out of the screen. */
  isCompleted: boolean;
  /** What semantic action this checkbox corresponds to (used for audit log) */
  action: string;
}

interface ProviderTimes {
  departure: string;
  reception: string;
}

const DEFAULT_TIMES: ProviderTimes = { departure: '14:00', reception: '09:00' };

// ============================================================================
// Date helpers
// ============================================================================

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function startOfWeek(d: Date): Date {
  const out = startOfDay(d);
  const dow = out.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  out.setDate(out.getDate() + offset);
  return out;
}

function endOfWeek(d: Date): Date {
  const start = startOfWeek(d);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return end;
}

function dateMatchesFilter(movement: Movement, filter: DateFilter, now: Date): boolean {
  const date = movement.scheduledAt;
  if (date === null) return filter === 'today';
  const today = startOfDay(now);
  switch (filter) {
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      return isSameDay(date, yesterday);
    }
    case 'today':
      // "Today" includes both scheduled-for-today AND overdue items still pending
      // (reliquat). Reliquat sits at the top via the existing date sort.
      if (isSameDay(date, today)) return true;
      return date < today && !movement.isCompleted;
    case 'tomorrow': {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return isSameDay(date, tomorrow);
    }
    case 'week':
      return date >= startOfWeek(now) && date < endOfWeek(now);
  }
}

function formatTimeOfDay(d: Date | null, fallback: string): string {
  if (d === null) return fallback;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function combineDateAndTime(dateOnly: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map((s) => parseInt(s, 10));
  const out = new Date(dateOnly);
  out.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return out;
}

// ============================================================================
// Derivation: FluxJob[] + Provider[] + Snapshot → Movement[]
// ============================================================================

interface DeriveContext {
  jobs: FluxJob[];
  providersByName: Map<string, ProviderTimes>;
  assignmentsByTaskId: Map<string, TaskAssignment>;
  jobsByInternalId: Map<string, JobEntity>;
}

function deriveMovements(ctx: DeriveContext): Movement[] {
  const { jobs, providersByName, assignmentsByTaskId, jobsByInternalId } = ctx;
  const movements: Movement[] = [];

  for (const job of jobs) {
    const jobLabel = job.designation ? `${job.client} · ${job.designation}` : job.client;
    const internalJob = job.internalId !== undefined ? jobsByInternalId.get(job.internalId) : undefined;

    for (const element of job.elements) {
      for (const out of element.outsourcing) {
        const times = providersByName.get(out.providerName) ?? DEFAULT_TIMES;
        const assignment = assignmentsByTaskId.get(out.taskId);
        const startDate = assignment !== undefined ? new Date(assignment.scheduledStart) : null;
        const endDate = assignment !== undefined ? new Date(assignment.scheduledEnd) : null;
        const completedDate = assignment?.completedAt !== null && assignment?.completedAt !== undefined
          ? new Date(assignment.completedAt)
          : null;

        // Departure row: visible from "to dispatch" through "dispatched/done".
        // isCompleted once status moves past pending.
        const departureScheduledAt = startDate
          ? combineDateAndTime(startOfDay(startDate), times.departure)
          : null;
        const departureDone = out.status === 'progress' || out.status === 'done';
        movements.push({
          id: `task-departure-${out.taskId}`,
          kind: 'departure',
          type: 'st',
          refType: 'task',
          refId: out.taskId,
          scheduledAt: departureScheduledAt,
          time: formatTimeOfDay(departureScheduledAt, times.departure),
          title: `Départ ST · ${out.actionType || 'sous-traitance'}`,
          subtitle: `Job #${job.id} — ${jobLabel}`,
          counterparty: out.providerName || '—',
          jobRef: `#${job.id}`,
          stStatus: out.status,
          jobInternalId: job.internalId,
          isCompleted: departureDone,
          action: 'st_dispatch',
        });

        // Return row: visible from "to receive" through "received".
        // isCompleted once status reaches done. Date prefers completedAt
        // (real reception time) when available, otherwise scheduledEnd.
        const returnScheduledAt = (() => {
          if (out.status === 'done' && completedDate !== null) return completedDate;
          if (endDate !== null) return combineDateAndTime(startOfDay(endDate), times.reception);
          return null;
        })();
        const returnDone = out.status === 'done';
        movements.push({
          id: `task-arrival-${out.taskId}`,
          kind: 'arrival',
          type: 'st',
          refType: 'task',
          refId: out.taskId,
          scheduledAt: returnScheduledAt,
          time: formatTimeOfDay(returnScheduledAt, times.reception),
          title: `Retour ST · ${out.actionType || 'sous-traitance'}`,
          subtitle: `Job #${job.id} — ${jobLabel}`,
          counterparty: out.providerName || '—',
          jobRef: `#${job.id}`,
          stStatus: out.status,
          jobInternalId: job.internalId,
          isCompleted: returnDone,
          action: 'st_return',
        });
      }
    }

    if (internalJob === undefined || job.internalId === undefined) continue;

    const exitDate = internalJob.workshopExitDate ? new Date(internalJob.workshopExitDate) : null;

    // Always emit one client-expedition row per job: kept even between the
    // optimistic update and the snapshot re-fetch (where shipped=true but
    // shippedAt may briefly still be null) — falling back to exitDate or
    // now() so the row never vanishes.
    const shippedAt = internalJob.shipped
      ? (internalJob.shippedAt ? new Date(internalJob.shippedAt) : (exitDate ?? new Date()))
      : null;
    movements.push({
      id: `job-shipped-${job.internalId}`,
      kind: 'departure',
      type: 'client',
      refType: 'job',
      refId: job.internalId,
      scheduledAt: shippedAt ?? exitDate,
      time: formatTimeOfDay(shippedAt ?? exitDate, '17:00'),
      title: 'Expédition client',
      subtitle: `Job #${job.id} — ${jobLabel}`,
      counterparty: job.client,
      jobRef: `#${job.id}`,
      jobInternalId: job.internalId,
      isCompleted: internalJob.shipped,
      action: 'client_ship',
    });
  }

  movements.sort((a, b) => {
    if (a.scheduledAt === null && b.scheduledAt === null) return 0;
    if (a.scheduledAt === null) return 1;
    if (b.scheduledAt === null) return -1;
    return a.scheduledAt.getTime() - b.scheduledAt.getTime();
  });

  return movements;
}

// ============================================================================
// Constants
// ============================================================================

const TYPE_BADGE_CLASS: Record<MovementType, string> = {
  st: 'text-blue-300 bg-blue-500/10',
  client: 'text-amber-300 bg-amber-500/10',
};

const TYPE_BADGE_LABEL: Record<MovementType, string> = {
  st: 'ST',
  client: 'CLIENT',
};

const TYPE_FULL_LABEL: Record<MovementType, string> = {
  st: 'Sous-traitant',
  client: 'Client',
};

/**
 * Transition gating for the checkbox click.
 *
 * Returns null when the click is a no-op (e.g. clicking a Departure row
 * whose underlying task is already returned — that semantic doesn't make
 * sense, you'd undo the return first).
 */
function computeTransition(m: Movement): { status?: FluxSTStatus; action: string } | null {
  if (m.type === 'st') {
    if (m.kind === 'departure') {
      if (m.stStatus === 'pending') return { status: 'progress', action: 'st_dispatch' };
      if (m.stStatus === 'progress') return { status: 'pending', action: 'st_revert_dispatch' };
      return null;
    }
    if (m.stStatus === 'progress') return { status: 'done', action: 'st_return' };
    if (m.stStatus === 'done') return { status: 'progress', action: 'st_revert_return' };
    return null;
  }
  if (m.type === 'client') {
    return { action: m.isCompleted ? 'client_revert_ship' : 'client_ship' };
  }
  return null;
}

function formatAuditTooltip(audit: LogisticsAuditResponse): string {
  const when = new Date(audit.occurredAt);
  const today = startOfDay(new Date());
  const sameDay = isSameDay(when, today);
  const time = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
  const date = sameDay
    ? "aujourd'hui"
    : `${String(when.getDate()).padStart(2, '0')}/${String(when.getMonth() + 1).padStart(2, '0')}`;
  return `${audit.actorName} — ${date} à ${time}`;
}

// ============================================================================
// Page
// ============================================================================

export function LogistiquePage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<DateFilter>('today');
  const [openCommentId, setOpenCommentId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [sheetMovement, setSheetMovement] = useState<Movement | null>(null);

  const currentUser = useAppSelector(selectCurrentUser);
  const actorName = currentUser?.displayName ?? 'Utilisateur';

  const { data: jobs = [] } = useGetFluxJobsQuery();
  const { data: providers = [] } = useGetProvidersQuery();
  const { data: snapshot } = useGetSnapshotQuery();
  const [updateSTStatus] = useUpdateSTStatusMutation();
  const [toggleJobShipped] = useToggleJobShippedMutation();
  const [createNote] = useCreateLogisticsNoteMutation();
  const [deleteNote] = useDeleteLogisticsNoteMutation();
  const [createAudit] = useCreateLogisticsAuditMutation();

  const now = useMemo(() => new Date(), []);

  const providersByName = useMemo(() => {
    const map = new Map<string, ProviderTimes>();
    for (const p of providers) {
      map.set(p.name, { departure: p.latestDepartureTime, reception: p.receptionTime });
    }
    return map;
  }, [providers]);

  const assignmentsByTaskId = useMemo(() => {
    const map = new Map<string, TaskAssignment>();
    for (const a of snapshot?.assignments ?? []) map.set(a.taskId, a);
    return map;
  }, [snapshot]);

  const jobsByInternalId = useMemo(() => {
    const map = new Map<string, JobEntity>();
    for (const j of snapshot?.jobs ?? []) map.set(j.id, j);
    return map;
  }, [snapshot]);

  const allMovements = useMemo(
    () =>
      deriveMovements({
        jobs,
        providersByName,
        assignmentsByTaskId,
        jobsByInternalId,
      }),
    [jobs, providersByName, assignmentsByTaskId, jobsByInternalId],
  );

  const filteredMovements = useMemo(
    () => allMovements.filter((m) => dateMatchesFilter(m, filter, now)),
    [allMovements, filter, now],
  );

  const reliquat = useMemo(
    () =>
      allMovements.filter((m) => {
        if (m.isCompleted) return false;
        if (m.scheduledAt === null) return false;
        return m.scheduledAt < startOfDay(now);
      }),
    [allMovements, now],
  );

  const arrivals = filteredMovements.filter((m) => m.kind === 'arrival');
  const departures = filteredMovements.filter((m) => m.kind === 'departure');

  const taskRefIds = filteredMovements.filter((m) => m.refType === 'task').map((m) => m.refId);
  const jobRefIds = filteredMovements.filter((m) => m.refType === 'job').map((m) => m.refId);

  const { data: taskNotes = [] } = useGetLogisticsNotesQuery(
    { refType: 'task', refIds: taskRefIds },
    { skip: taskRefIds.length === 0 },
  );
  const { data: jobNotes = [] } = useGetLogisticsNotesQuery(
    { refType: 'job', refIds: jobRefIds },
    { skip: jobRefIds.length === 0 },
  );
  const { data: taskAudits = [] } = useGetLatestLogisticsAuditsQuery(
    { refType: 'task', refIds: taskRefIds },
    { skip: taskRefIds.length === 0 },
  );
  const { data: jobAudits = [] } = useGetLatestLogisticsAuditsQuery(
    { refType: 'job', refIds: jobRefIds },
    { skip: jobRefIds.length === 0 },
  );

  const notesByRef = useMemo(() => {
    const map = new Map<string, LogisticsNoteResponse>();
    for (const n of [...taskNotes, ...jobNotes]) {
      const key = `${n.refType}:${n.refId}`;
      const existing = map.get(key);
      if (!existing || existing.createdAt < n.createdAt) {
        map.set(key, n);
      }
    }
    return map;
  }, [taskNotes, jobNotes]);

  const auditsByRef = useMemo(() => {
    const map = new Map<string, LogisticsAuditResponse>();
    for (const a of [...taskAudits, ...jobAudits]) {
      map.set(`${a.refType}:${a.refId}`, a);
    }
    return map;
  }, [taskAudits, jobAudits]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleCheck = useCallback(
    async (m: Movement) => {
      const transition = computeTransition(m);
      if (transition === null) return;
      if (m.type === 'st' && transition.status !== undefined) {
        await updateSTStatus({ taskId: m.refId, status: transition.status });
      } else if (m.type === 'client' && m.jobInternalId !== undefined) {
        await toggleJobShipped({ jobInternalId: m.jobInternalId, shipped: !m.isCompleted });
      }
      await createAudit({
        refType: m.refType,
        refId: m.refId,
        action: transition.action,
        actorName,
      });
    },
    [updateSTStatus, toggleJobShipped, createAudit, actorName],
  );

  const handleSaveNote = useCallback(
    async (m: Movement, content: string) => {
      const trimmed = content.trim();
      if (trimmed === '') return;
      await createNote({ refType: m.refType, refId: m.refId, note: trimmed });
      setOpenCommentId(null);
      setEditingNoteId(null);
      setDraft('');
    },
    [createNote],
  );

  const handleDeleteNote = useCallback(
    async (id: string) => {
      await deleteNote(id);
    },
    [deleteNote],
  );

  const handleNavigateToJob = useCallback(
    (jobInternalId?: string) => {
      if (jobInternalId === undefined) return;
      navigate(`/job/${jobInternalId}`);
    },
    [navigate],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-flux-base flex flex-col">
      <header className="border-b border-flux-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-flux-text-secondary hover:text-flux-text-primary transition-colors"
            title="Retour (Esc)"
          >
            <ArrowLeft size={20} />
            <span>Retour</span>
          </button>
          <div>
            <h1 className="text-xl font-semibold text-flux-text-primary">Logistique</h1>
            <div className="text-flux-text-tertiary text-xs">Réceptions et expéditions de l'atelier</div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between gap-6 flex-wrap mb-5">
          <div className="flex gap-1">
            {(['yesterday', 'today', 'tomorrow', 'week'] as DateFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                  filter === f
                    ? 'bg-flux-hover border-flux-border-light text-flux-text-primary'
                    : 'border-flux-border text-flux-text-secondary hover:bg-flux-hover hover:text-flux-text-primary'
                }`}
              >
                {f === 'yesterday' ? 'Hier' : f === 'today' ? "Aujourd'hui" : f === 'tomorrow' ? 'Demain' : 'Cette semaine'}
              </button>
            ))}
          </div>

          <div className="flex gap-6 text-sm text-flux-text-tertiary">
            <div>
              <span className="text-flux-text-primary font-semibold mr-1">{arrivals.length}</span>
              arrivées
            </div>
            <div>
              <span className="text-flux-text-primary font-semibold mr-1">{departures.length}</span>
              départs
            </div>
            {reliquat.length > 0 && (
              <div>
                <span className="text-red-400 font-semibold mr-1">{reliquat.length}</span>
                <span className="text-red-400">reliquat</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Column
            title="Arrivées"
            icon={<ArrowRightToLine size={16} className="text-flux-text-tertiary" />}
            count={arrivals.length}
            movements={arrivals}
            notesByRef={notesByRef}
            auditsByRef={auditsByRef}
            openCommentId={openCommentId}
            editingNoteId={editingNoteId}
            draft={draft}
            onCheck={handleCheck}
            onToggleComment={(id) => {
              setOpenCommentId((prev) => (prev === id ? null : id));
              setDraft('');
              setEditingNoteId(null);
            }}
            onEditNote={(noteId, content) => {
              setEditingNoteId(noteId);
              setDraft(content);
            }}
            onDraftChange={setDraft}
            onSave={handleSaveNote}
            onDeleteNote={handleDeleteNote}
            onOpenSheet={setSheetMovement}
          />
          <Column
            title="Départs"
            icon={<ArrowRightFromLine size={16} className="text-flux-text-tertiary" />}
            count={departures.length}
            movements={departures}
            notesByRef={notesByRef}
            auditsByRef={auditsByRef}
            openCommentId={openCommentId}
            editingNoteId={editingNoteId}
            draft={draft}
            onCheck={handleCheck}
            onToggleComment={(id) => {
              setOpenCommentId((prev) => (prev === id ? null : id));
              setDraft('');
              setEditingNoteId(null);
            }}
            onEditNote={(noteId, content) => {
              setEditingNoteId(noteId);
              setDraft(content);
            }}
            onDraftChange={setDraft}
            onSave={handleSaveNote}
            onDeleteNote={handleDeleteNote}
            onOpenSheet={setSheetMovement}
          />
        </div>
      </main>

      {sheetMovement && (
        <DetailSheet
          movement={sheetMovement}
          note={notesByRef.get(`${sheetMovement.refType}:${sheetMovement.refId}`) ?? null}
          audit={auditsByRef.get(`${sheetMovement.refType}:${sheetMovement.refId}`) ?? null}
          onClose={() => setSheetMovement(null)}
          onNavigateToJob={handleNavigateToJob}
        />
      )}
    </div>
  );
}

// ============================================================================
// Column
// ============================================================================

interface ColumnProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  movements: Movement[];
  notesByRef: Map<string, LogisticsNoteResponse>;
  auditsByRef: Map<string, LogisticsAuditResponse>;
  openCommentId: string | null;
  editingNoteId: string | null;
  draft: string;
  onCheck: (m: Movement) => void;
  onToggleComment: (id: string) => void;
  onEditNote: (noteId: string, content: string) => void;
  onDraftChange: (v: string) => void;
  onSave: (m: Movement, content: string) => void;
  onDeleteNote: (id: string) => void;
  onOpenSheet: (m: Movement) => void;
}

function Column({
  title,
  icon,
  count,
  movements,
  notesByRef,
  auditsByRef,
  openCommentId,
  editingNoteId,
  draft,
  onCheck,
  onToggleComment,
  onEditNote,
  onDraftChange,
  onSave,
  onDeleteNote,
  onOpenSheet,
}: ColumnProps) {
  return (
    <section>
      <header className="flex items-center justify-between border-b border-flux-border pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-flux-text-primary font-semibold text-base">{title}</h2>
        </div>
        <div className="text-flux-text-tertiary text-xs">{count} prévues</div>
      </header>

      {movements.length === 0 ? (
        <div className="bg-flux-elevated border border-flux-border rounded-md text-center text-flux-text-muted text-xs italic py-8">
          Aucun mouvement
        </div>
      ) : (
        <div className="bg-flux-elevated border border-flux-border rounded-md overflow-hidden" data-testid={`logistics-column-${title.toLowerCase()}`}>
          {movements.map((m, idx) => {
            const note = notesByRef.get(`${m.refType}:${m.refId}`);
            const audit = auditsByRef.get(`${m.refType}:${m.refId}`);
            const isCommentOpen = openCommentId === m.id;
            const isEditingNote = note !== undefined && editingNoteId === note.id;
            return (
              <div
                key={m.id}
                className={idx < movements.length - 1 ? 'border-b border-flux-border' : ''}
              >
                <MovementRow
                  movement={m}
                  hasNote={note !== undefined}
                  audit={audit}
                  onCheck={onCheck}
                  onToggleComment={onToggleComment}
                  onOpenSheet={onOpenSheet}
                />
                {isCommentOpen && (
                  <div className="px-3.5 pl-[88px] pb-3 pt-1 bg-flux-surface border-t border-dashed border-flux-border">
                    {note && !isEditingNote ? (
                      <div className="flex items-center gap-2 text-flux-text-secondary text-xs bg-flux-hover px-2.5 py-1.5 rounded border-l-2 border-blue-400">
                        <MessageSquare size={12} className="text-blue-400 shrink-0" />
                        <span className="flex-1">{note.note}</span>
                        <button
                          onClick={() => onEditNote(note.id, note.note)}
                          className="p-1 text-flux-text-tertiary hover:text-flux-text-primary"
                          title="Éditer"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => onDeleteNote(note.id)}
                          className="p-1 text-flux-text-tertiary hover:text-red-400"
                          title="Supprimer"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          autoFocus
                          value={draft}
                          onChange={(e) => onDraftChange(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') onSave(m, draft);
                            else if (e.key === 'Escape') onToggleComment(m.id);
                          }}
                          placeholder="Anomalie, retard, manque…  (Entrée pour valider, Esc pour fermer)"
                          className="w-full px-2.5 py-1.5 bg-flux-hover border border-flux-border-light rounded text-flux-text-primary text-xs focus:outline-none focus:border-flux-text-tertiary"
                        />
                        <div className="text-flux-text-muted text-[10px] mt-1">
                          Texte libre — visible par toute l'équipe
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ============================================================================
// Movement row
// ============================================================================

interface MovementRowProps {
  movement: Movement;
  hasNote: boolean;
  audit: LogisticsAuditResponse | undefined;
  onCheck: (m: Movement) => void;
  onToggleComment: (id: string) => void;
  onOpenSheet: (m: Movement) => void;
}

function MovementRow({ movement, hasNote, audit, onCheck, onToggleComment, onOpenSheet }: MovementRowProps) {
  const today = startOfDay(new Date());
  const isOverdue = !movement.isCompleted && movement.scheduledAt !== null && movement.scheduledAt < today;
  const overdueDays = isOverdue && movement.scheduledAt
    ? Math.max(1, Math.floor((today.getTime() - startOfDay(movement.scheduledAt).getTime()) / 86_400_000))
    : 0;

  const transition = computeTransition(movement);
  const isLocked = transition === null;

  const rowClass = movement.isCompleted
    ? 'bg-emerald-500/[0.08] hover:bg-emerald-500/[0.14] border-l-2 border-emerald-400'
    : isLocked
      ? 'opacity-60 hover:bg-flux-hover'
      : isOverdue
        ? 'bg-red-500/[0.07] hover:bg-red-500/[0.12] border-l-2 border-red-400'
        : 'hover:bg-flux-hover';

  const checkClass = movement.isCompleted
    ? 'bg-emerald-400 border-emerald-400 text-flux-base'
    : isLocked
      ? 'border-flux-border bg-flux-surface text-transparent cursor-not-allowed'
      : 'border-flux-border-light hover:border-flux-text-tertiary bg-transparent text-transparent';

  const checkTitle = movement.isCompleted
    ? audit
      ? `Effectué — ${formatAuditTooltip(audit)}\nClic = annuler`
      : 'Effectué (clic pour annuler)'
    : isLocked
      ? movement.kind === 'arrival'
        ? 'Le départ n\'a pas encore été effectué'
        : 'Cette tâche est déjà revenue'
      : 'Marquer comme effectué';

  const timeDisplay = isOverdue && movement.time
    ? `J-${overdueDays} ${movement.time}`
    : movement.time || '—';

  const overdueDate = movement.scheduledAt
    ? `${String(movement.scheduledAt.getDate()).padStart(2, '0')}/${String(movement.scheduledAt.getMonth() + 1).padStart(2, '0')}`
    : '';
  const overdueHour = movement.scheduledAt
    ? `${String(movement.scheduledAt.getHours()).padStart(2, '0')}h`
    : '';

  return (
    <div
      className={`grid items-center gap-3 px-3.5 py-2.5 cursor-pointer transition-colors ${rowClass}`}
      style={{ gridTemplateColumns: '76px 76px 1fr auto' }}
      onClick={() => onOpenSheet(movement)}
      data-testid={`logistics-movement-${movement.id}`}
      data-completed={movement.isCompleted ? 'true' : 'false'}
      data-kind={movement.kind}
      data-type={movement.type}
    >
      <div className={`text-sm tabular-nums ${isOverdue ? 'text-red-400 font-semibold' : movement.isCompleted ? 'text-flux-text-tertiary' : 'text-flux-text-secondary'}`}>
        {timeDisplay}
      </div>
      <div>
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${TYPE_BADGE_CLASS[movement.type]}`}>
          {TYPE_BADGE_LABEL[movement.type]}
        </span>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className={`text-sm font-medium truncate ${movement.isCompleted ? 'text-emerald-300' : 'text-flux-text-primary'}`}>
            {movement.title}
          </div>
          {isOverdue && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide text-red-400 bg-red-500/10 border border-red-500/30 shrink-0"
            >
              <AlertTriangle size={10} />
              Retard {overdueDays}J ({overdueDate}) {overdueHour}
            </span>
          )}
        </div>
        <div className="text-flux-text-tertiary text-xs truncate">{movement.subtitle}</div>
      </div>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => onToggleComment(movement.id)}
          className={`w-7 h-7 inline-flex items-center justify-center rounded hover:bg-flux-active transition-colors ${
            hasNote ? 'text-blue-400' : 'text-flux-text-tertiary hover:text-flux-text-primary'
          }`}
          title={hasNote ? 'Voir / éditer le commentaire' : 'Ajouter un commentaire'}
        >
          <MessageSquare size={14} />
        </button>
        <button
          type="button"
          onClick={() => onCheck(movement)}
          disabled={isLocked}
          className={`w-[22px] h-[22px] inline-flex items-center justify-center rounded border-[1.5px] shrink-0 transition-colors ${checkClass}`}
          title={checkTitle}
          aria-label={checkTitle}
          data-testid={`logistics-check-${movement.id}`}
        >
          <Check size={14} />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Side-sheet
// ============================================================================

interface DetailSheetProps {
  movement: Movement;
  note: LogisticsNoteResponse | null;
  audit: LogisticsAuditResponse | null;
  onClose: () => void;
  onNavigateToJob: (jobInternalId?: string) => void;
}

function DetailSheet({ movement, note, audit, onClose, onNavigateToJob }: DetailSheetProps) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <aside className="fixed top-0 right-0 w-[420px] h-screen bg-flux-elevated border-l border-flux-border-light z-50 flex flex-col">
        <div className="px-5 py-4 border-b border-flux-border flex items-center justify-between">
          <h3 className="text-base font-semibold text-flux-text-primary">{movement.title}</h3>
          <button onClick={onClose} className="p-1 text-flux-text-tertiary hover:text-flux-text-primary">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <Field
            label="Type"
            value={
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${TYPE_BADGE_CLASS[movement.type]}`}>
                {TYPE_FULL_LABEL[movement.type]}
              </span>
            }
          />
          <Field label="Heure prévue" value={movement.time || '—'} />
          <Field label="Contrepartie" value={movement.counterparty} />
          <Field label="Référence" value={movement.jobRef} />
          <Field label="Détail" value={movement.subtitle} />
          <Field
            label="Statut"
            value={
              movement.isCompleted ? (
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <span>Effectué{audit ? ` — ${formatAuditTooltip(audit)}` : ''}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={14} className="text-flux-text-tertiary shrink-0" />
                  <span>En attente</span>
                </span>
              )
            }
          />
          {note && (
            <Field
              label="Commentaire"
              value={
                <div className="bg-flux-surface border-l-2 border-blue-400 px-2.5 py-2 rounded-r text-flux-text-secondary">
                  {note.note}
                </div>
              }
            />
          )}
          <button
            type="button"
            onClick={() => {
              onNavigateToJob(movement.jobInternalId);
              onClose();
            }}
            disabled={movement.jobInternalId === undefined}
            className="mt-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-flux-text-primary rounded text-xs font-medium inline-flex items-center gap-1.5"
          >
            Voir le job complet <ArrowRight size={12} />
          </button>
        </div>
      </aside>
    </>
  );
}

interface FieldProps {
  label: string;
  value: React.ReactNode;
}

function Field({ label, value }: FieldProps) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-flux-text-muted font-semibold mb-0.5">{label}</div>
      <div className="text-sm text-flux-text-primary">{value}</div>
    </div>
  );
}
