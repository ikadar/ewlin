/**
 * LogistiquePage — /logistique
 *
 * Operational view of the warehouse: incoming reception (sous-traitance returns)
 * and outgoing shipments (sous-traitance dispatch + client expedition).
 *
 * Phase 1.1 features (2026-04-27):
 *   - Date filter (Hier / Aujourd'hui / Demain / Cette semaine) — based on
 *     scheduledStart / scheduledEnd from the schedule snapshot. Client
 *     expeditions track the live planning too: scheduledAt = scheduledEnd
 *     of the job's last task. workshopExitDate is kept as the `deadline`
 *     reference so we can still surface contractual lateness.
 *   - Reliquat — overdue movements (scheduled < today, not processed) appear
 *     at the top of their column with a red accent bar + "Reliquat · Nj" badge,
 *     still cockable. The toolbar counter shows how many are visible.
 *   - Each check writes a LogisticsAudit (who/when), surfaced as tooltip.
 *   - Recently-completed movements (today) stay visible, dimmed.
 *   - "Voir le job complet" navigates to the scheduler with the job selected.
 */

import { useMemo, useState, useCallback } from 'react';
import {
  ArrowRightToLine,
  ArrowRightFromLine,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Pencil,
  X,
  AlertTriangle,
} from 'lucide-react';
import { PendingIcon, ProgressIcon, DoneIcon } from '../components/FluxTable/STCell';
import {
  useGetFluxJobsQuery,
  useUpdateSTStatusMutation,
  useToggleJobShippedMutation,
  useUpdateElementPrerequisiteMutation,
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
import { useGetSnapshotQuery, useGetPaperLeadTimeQuery, useGetFormeLeadTimeQuery } from '../store/api/scheduleApi';
import { useAppSelector } from '../store';
import { selectCurrentUser } from '../store/slices/authSlice';
import type { FluxJob, FluxSTStatus } from '../components/FluxTable/fluxTypes';
import type { TaskAssignment, Job as JobEntity, Task, OutsourcedProvider } from '@flux/types';
import { isOutsourcedTask } from '@flux/types';
import { calculateOutsourcingDates } from '../utils/outsourcingCalculation';
import { computePaperEarliestStart } from '../utils/paperGate';
import { computeFormeEarliestStart } from '../utils/formeGate';
import type { PaperLeadTimeConfig, FormeLeadTimeConfig } from '@flux/types';

// ============================================================================
// Movement model
// ============================================================================

type MovementType = 'st' | 'client' | 'paper' | 'forme';
interface Movement {
  id: string;
  kind: 'arrival' | 'departure';
  type: MovementType;
  refType: LogisticsRefType;
  refId: string;
  /** Planned datetime — when this movement is *expected* to occur according
   *  to the live planning. Comes from the engine's scheduledEnd (predecessor
   *  for ST departures, last-task for client expeditions). Migrates when
   *  the planning recalculates upstream; stays put when the user checks
   *  the row (the actual moment lives in `actualAt`). */
  scheduledAt: Date | null;
  /** Contractual deadline reference. Populated for client expeditions
   *  (= job.workshopExitDate). When `scheduledAt > deadline`, the planning
   *  predicts the job ships late vs. its commitment — used for visual
   *  signalling. Undefined for movements with no contractual deadline. */
  deadline?: Date | null;
  /** Actual datetime — when the movement was physically performed.
   *  Null until checked; populated from completedAt / shippedAt / latest
   *  audit when available. Displayed in the second time column. */
  actualAt: Date | null;
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
  /** Element UUID — paper/forme movements only (used for the prerequisite PATCH) */
  elementId?: string;
  /** Prerequisite column name — paper/forme movements only */
  prerequisiteColumn?: 'papier' | 'formes';
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

function dateMatchesDay(movement: Movement, day: Date, now: Date): boolean {
  const today = startOfDay(now);
  const planned = movement.scheduledAt;
  const actual = movement.actualAt;

  if (planned !== null && isSameDay(planned, day)) return true;
  if (actual !== null && isSameDay(actual, day)) return true;

  // Reliquat: when viewing today, include still-pending past-due items
  // so the warehouse staff sees what they should already have processed.
  const isToday = day.getTime() === today.getTime();
  if (isToday && planned !== null && planned < today && !movement.isCompleted) return true;

  return false;
}

function formatDateLabel(d: Date, now: Date): string {
  const today = startOfDay(now);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  const formatted = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' });
  const capitalized = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  if (diff === 0) return `Aujourd'hui — ${capitalized}`;
  if (diff === -1) return `Hier — ${capitalized}`;
  if (diff === 1) return `Demain — ${capitalized}`;
  return capitalized;
}

function formatActualTime(d: Date | null, today: Date): string {
  if (d === null) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (isSameDay(d, today)) return `${hh}:${mm}`;
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mo} ${hh}:${mm}`;
}

function formatTimeOfDay(d: Date | null, fallback: string): string {
  if (d === null) return fallback;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Format like "29/04 14:00" — date+time when known, fallback HH:MM otherwise. */
function formatPlannedTime(d: Date | null, today: Date, fallback: string): string {
  if (d === null) return fallback;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (isSameDay(d, today)) return `${hh}:${mm}`;
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mo} ${hh}:${mm}`;
}

function parseDDMM(ddmm: string, referenceYear: number): Date {
  const [d, m] = ddmm.split('/').map(Number);
  return new Date(referenceYear, m - 1, d);
}

// ============================================================================
// Derivation: FluxJob[] + Provider[] + Snapshot → Movement[]
// ============================================================================

interface DeriveContext {
  jobs: FluxJob[];
  providersByName: Map<string, ProviderTimes>;
  providersById: Map<string, OutsourcedProvider>;
  assignmentsByTaskId: Map<string, TaskAssignment>;
  jobsByInternalId: Map<string, JobEntity>;
  tasksByTaskId: Map<string, Task>;
  /** elementId → tasks of that element sorted by sequenceOrder */
  tasksByElementId: Map<string, Task[]>;
  /** Last sequenceOrder across all elements of a job → used for oneWay detection */
  lastSequenceByJobInternalId: Map<string, { elementId: string; sequenceOrder: number }>;
  paperLeadTime?: PaperLeadTimeConfig;
  formeLeadTime?: FormeLeadTimeConfig;
  now: Date;
}

function deriveMovements(ctx: DeriveContext): Movement[] {
  const {
    jobs,
    providersByName,
    providersById,
    assignmentsByTaskId,
    jobsByInternalId,
    tasksByTaskId,
    tasksByElementId,
    lastSequenceByJobInternalId,
  } = ctx;
  const movements: Movement[] = [];

  for (const job of jobs) {
    const jobLabel = job.designation ? `${job.client} · ${job.designation}` : job.client;
    const internalJob = job.internalId !== undefined ? jobsByInternalId.get(job.internalId) : undefined;
    const lastSeq = job.internalId !== undefined ? lastSequenceByJobInternalId.get(job.internalId) : undefined;

    for (const element of job.elements) {
      for (const out of element.outsourcing) {
        const times = providersByName.get(out.providerName) ?? DEFAULT_TIMES;
        const fullTask = tasksByTaskId.get(out.taskId);
        const isOut = fullTask !== undefined && isOutsourcedTask(fullTask);
        const provider = isOut ? providersById.get(fullTask.providerId) : undefined;

        // Find predecessor task (sequenceOrder - 1 in the same element) and
        // its scheduledEnd, which drives the engine's outsourcing-date math.
        let predecessorEndTime: string | undefined;
        if (isOut) {
          const elementTasks = tasksByElementId.get(fullTask.elementId) ?? [];
          const predecessor = elementTasks.find((t) => t.sequenceOrder === fullTask.sequenceOrder - 1);
          if (predecessor) {
            const predAssignment = assignmentsByTaskId.get(predecessor.id);
            if (predAssignment) predecessorEndTime = predAssignment.scheduledEnd;
          }
        }

        // oneWay = this is the very last task of the entire job → product
        // ships directly from the provider to the customer, no return leg.
        const isLastTaskOfJob = isOut && lastSeq !== undefined
          && lastSeq.elementId === fullTask.elementId
          && lastSeq.sequenceOrder === fullTask.sequenceOrder;

        const calculated = (isOut && provider !== undefined)
          ? calculateOutsourcingDates(predecessorEndTime, {
              workDays: fullTask.duration.openDays,
              latestDepartureTime: provider.latestDepartureTime,
              receptionTime: provider.receptionTime,
              transitDays: provider.transitDays,
              oneWay: isLastTaskOfJob,
            })
          : null;

        // Manual overrides on the Task (if the user typed them in the
        // mini-form) win over the calculated values.
        const manualDeparture = isOut && fullTask.manualDeparture ? new Date(fullTask.manualDeparture) : null;
        const manualReturn = isOut && fullTask.manualReturn ? new Date(fullTask.manualReturn) : null;

        const departureDate = manualDeparture ?? calculated?.departure ?? null;
        const returnDate = manualReturn ?? calculated?.return ?? null;

        const assignment = assignmentsByTaskId.get(out.taskId);
        const completedDate = assignment?.completedAt !== null && assignment?.completedAt !== undefined
          ? new Date(assignment.completedAt)
          : null;

        const departureDone = out.status === 'progress' || out.status === 'done';
        movements.push({
          id: `task-departure-${out.taskId}`,
          kind: 'departure',
          type: 'st',
          refType: 'task',
          refId: out.taskId,
          scheduledAt: departureDate,
          actualAt: null,
          time: departureDate ? formatTimeOfDay(departureDate, '') : times.departure,
          title: `Départ ST · ${out.actionType || 'sous-traitance'}`,
          subtitle: `Job #${job.id} — ${jobLabel}`,
          counterparty: out.providerName || '—',
          jobRef: `#${job.id}`,
          stStatus: out.status,
          jobInternalId: job.internalId,
          isCompleted: departureDone,
          action: 'st_dispatch',
        });

        // Skip the Return row entirely when this ST step is the very last
        // task of the job — "aller simple" means the provider ships directly
        // to the customer, there's no return leg to track.
        if (!isLastTaskOfJob) {
          const returnDone = out.status === 'done';
          movements.push({
            id: `task-arrival-${out.taskId}`,
            kind: 'arrival',
            type: 'st',
            refType: 'task',
            refId: out.taskId,
            scheduledAt: returnDate,
            actualAt: returnDone ? completedDate : null,
            time: returnDate ? formatTimeOfDay(returnDate, '') : times.reception,
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

      // ── Paper arrival ────────────────────────────────────────────────
      if (element.papier === 'ordered' && element.paperOrderedAt && ctx.paperLeadTime) {
        const orderedAt = parseDDMM(element.paperOrderedAt, ctx.now.getFullYear());
        const arrivalDate = computePaperEarliestStart(
          { paperStatus: 'ordered', paperOrderedAt: orderedAt.toISOString() },
          ctx.paperLeadTime,
          ctx.now,
        );
        movements.push({
          id: `element-paper-${element.id}`,
          kind: 'arrival',
          type: 'paper',
          refType: 'element',
          refId: element.id,
          scheduledAt: arrivalDate,
          actualAt: null,
          time: arrivalDate ? formatTimeOfDay(arrivalDate, '') : `${String(ctx.paperLeadTime.arrivalHour).padStart(2, '0')}:00`,
          title: 'Réception papier',
          subtitle: `Job #${job.id} — ${element.label}`,
          counterparty: 'Fournisseur',
          jobRef: `#${job.id}`,
          jobInternalId: job.internalId,
          elementId: element.id,
          prerequisiteColumn: 'papier',
          isCompleted: false,
          action: 'paper_deliver',
        });
      } else if (element.papier === 'delivered' && element.paperDeliveredAt) {
        const deliveredDate = parseDDMM(element.paperDeliveredAt, ctx.now.getFullYear());
        if (isSameDay(deliveredDate, ctx.now)) {
          movements.push({
            id: `element-paper-${element.id}`,
            kind: 'arrival',
            type: 'paper',
            refType: 'element',
            refId: element.id,
            scheduledAt: deliveredDate,
            actualAt: deliveredDate,
            time: formatTimeOfDay(deliveredDate, ''),
            title: 'Réception papier',
            subtitle: `Job #${job.id} — ${element.label}`,
            counterparty: 'Fournisseur',
            jobRef: `#${job.id}`,
            jobInternalId: job.internalId,
            elementId: element.id,
            prerequisiteColumn: 'papier',
            isCompleted: true,
            action: 'paper_deliver',
          });
        }
      }

      // ── Forme arrival ────────────────────────────────────────────────
      if (element.formes === 'ordered' && element.formeOrderedAt && ctx.formeLeadTime) {
        const orderedAt = parseDDMM(element.formeOrderedAt, ctx.now.getFullYear());
        const arrivalDate = computeFormeEarliestStart(
          { formeStatus: 'ordered', formeOrderedAt: orderedAt.toISOString() },
          ctx.formeLeadTime,
          ctx.now,
        );
        movements.push({
          id: `element-forme-${element.id}`,
          kind: 'arrival',
          type: 'forme',
          refType: 'element',
          refId: element.id,
          scheduledAt: arrivalDate,
          actualAt: null,
          time: arrivalDate ? formatTimeOfDay(arrivalDate, '') : `${String(ctx.formeLeadTime.arrivalHour).padStart(2, '0')}:00`,
          title: 'Réception forme',
          subtitle: `Job #${job.id} — ${element.label}`,
          counterparty: 'Fournisseur',
          jobRef: `#${job.id}`,
          jobInternalId: job.internalId,
          elementId: element.id,
          prerequisiteColumn: 'formes',
          isCompleted: false,
          action: 'forme_deliver',
        });
      } else if (element.formes === 'delivered' && element.formeDeliveredAt) {
        const deliveredDate = parseDDMM(element.formeDeliveredAt, ctx.now.getFullYear());
        if (isSameDay(deliveredDate, ctx.now)) {
          movements.push({
            id: `element-forme-${element.id}`,
            kind: 'arrival',
            type: 'forme',
            refType: 'element',
            refId: element.id,
            scheduledAt: deliveredDate,
            actualAt: deliveredDate,
            time: formatTimeOfDay(deliveredDate, ''),
            title: 'Réception forme',
            subtitle: `Job #${job.id} — ${element.label}`,
            counterparty: 'Fournisseur',
            jobRef: `#${job.id}`,
            jobInternalId: job.internalId,
            elementId: element.id,
            prerequisiteColumn: 'formes',
            isCompleted: true,
            action: 'forme_deliver',
          });
        }
      }
    }

    if (internalJob === undefined || job.internalId === undefined) continue;

    const exitDate = internalJob.workshopExitDate ? new Date(internalJob.workshopExitDate) : null;

    // Client-expedition row: scheduledAt = scheduledEnd of the job's last
    // task (highest sequenceOrder across elements), i.e. when the planning
    // says the product is actually ready to ship. Aligned with the ST flows,
    // which already track the live planning. workshopExitDate is preserved
    // as `deadline` so the row can flag "ready after the contractual
    // deadline" without anchoring the day-grouping to it.
    let readyAt: Date | null = null;
    if (lastSeq !== undefined) {
      const lastTask = (tasksByElementId.get(lastSeq.elementId) ?? [])
        .find((t) => t.sequenceOrder === lastSeq.sequenceOrder);
      const lastAssignment = lastTask !== undefined ? assignmentsByTaskId.get(lastTask.id) : undefined;
      if (lastAssignment !== undefined) {
        readyAt = new Date(lastAssignment.scheduledEnd);
      }
    }

    const shippedAt = internalJob.shipped
      ? (internalJob.shippedAt ? new Date(internalJob.shippedAt) : new Date())
      : null;
    movements.push({
      id: `job-shipped-${job.internalId}`,
      kind: 'departure',
      type: 'client',
      refType: 'job',
      refId: job.internalId,
      scheduledAt: readyAt,
      deadline: exitDate,
      actualAt: shippedAt,
      time: formatTimeOfDay(readyAt, '17:00'),
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
  paper: 'text-teal-300 bg-teal-500/10',
  forme: 'text-purple-300 bg-purple-500/10',
};

const TYPE_BADGE_LABEL: Record<MovementType, string> = {
  st: 'ST',
  client: 'CLIENT',
  paper: 'PAPIER',
  forme: 'FORME',
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
  if (m.type === 'paper') {
    return { action: m.isCompleted ? 'paper_revert_deliver' : 'paper_deliver' };
  }
  if (m.type === 'forme') {
    return { action: m.isCompleted ? 'forme_revert_deliver' : 'forme_deliver' };
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
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
  const [openCommentId, setOpenCommentId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>('');

  const currentUser = useAppSelector(selectCurrentUser);
  const actorName = currentUser?.displayName ?? 'Utilisateur';

  const { data: jobs = [] } = useGetFluxJobsQuery();
  const { data: providers = [] } = useGetProvidersQuery();
  const { data: snapshot } = useGetSnapshotQuery();
  const { data: paperLeadTime } = useGetPaperLeadTimeQuery();
  const { data: formeLeadTime } = useGetFormeLeadTimeQuery();
  const [updateSTStatus] = useUpdateSTStatusMutation();
  const [toggleJobShipped] = useToggleJobShippedMutation();
  const [updateElementPrerequisite] = useUpdateElementPrerequisiteMutation();
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

  const providersById = useMemo(() => {
    const map = new Map<string, OutsourcedProvider>();
    for (const p of snapshot?.providers ?? []) map.set(p.id, p);
    return map;
  }, [snapshot]);

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

  const tasksByTaskId = useMemo(() => {
    const map = new Map<string, Task>();
    for (const t of snapshot?.tasks ?? []) map.set(t.id, t);
    return map;
  }, [snapshot]);

  const tasksByElementId = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of snapshot?.tasks ?? []) {
      const list = map.get(t.elementId) ?? [];
      list.push(t);
      map.set(t.elementId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    }
    return map;
  }, [snapshot]);

  const lastSequenceByJobInternalId = useMemo(() => {
    // For oneWay detection: the "last task of a job" is the task with the
    // highest sequenceOrder across all elements of that job. Element order
    // within a job doesn't change the temporal end (parallel branches collapse
    // at the deadline), so the simple max-sequenceOrder rule is sufficient.
    const map = new Map<string, { elementId: string; sequenceOrder: number }>();
    for (const job of snapshot?.jobs ?? []) {
      let best: { elementId: string; sequenceOrder: number } | undefined;
      for (const elementId of job.elementIds) {
        const tasks = tasksByElementId.get(elementId) ?? [];
        for (const t of tasks) {
          if (best === undefined || t.sequenceOrder > best.sequenceOrder) {
            best = { elementId, sequenceOrder: t.sequenceOrder };
          }
        }
      }
      if (best !== undefined) map.set(job.id, best);
    }
    return map;
  }, [snapshot, tasksByElementId]);

  const allMovements = useMemo(
    () =>
      deriveMovements({
        jobs,
        providersByName,
        providersById,
        assignmentsByTaskId,
        jobsByInternalId,
        tasksByTaskId,
        tasksByElementId,
        lastSequenceByJobInternalId,
        paperLeadTime,
        formeLeadTime,
        now,
      }),
    [jobs, providersByName, providersById, assignmentsByTaskId, jobsByInternalId, tasksByTaskId, tasksByElementId, lastSequenceByJobInternalId, paperLeadTime, formeLeadTime, now],
  );

  const allTaskRefIds = useMemo(
    () => allMovements.filter((m) => m.refType === 'task').map((m) => m.refId),
    [allMovements],
  );
  const allJobRefIds = useMemo(
    () => allMovements.filter((m) => m.refType === 'job').map((m) => m.refId),
    [allMovements],
  );
  const allElementRefIds = useMemo(
    () => allMovements.filter((m) => m.refType === 'element').map((m) => m.refId),
    [allMovements],
  );

  const { data: taskNotes = [] } = useGetLogisticsNotesQuery(
    { refType: 'task', refIds: allTaskRefIds },
    { skip: allTaskRefIds.length === 0 },
  );
  const { data: jobNotes = [] } = useGetLogisticsNotesQuery(
    { refType: 'job', refIds: allJobRefIds },
    { skip: allJobRefIds.length === 0 },
  );
  const { data: taskAudits = [] } = useGetLatestLogisticsAuditsQuery(
    { refType: 'task', refIds: allTaskRefIds },
    { skip: allTaskRefIds.length === 0 },
  );
  const { data: jobAudits = [] } = useGetLatestLogisticsAuditsQuery(
    { refType: 'job', refIds: allJobRefIds },
    { skip: allJobRefIds.length === 0 },
  );
  const { data: elementNotes = [] } = useGetLogisticsNotesQuery(
    { refType: 'element', refIds: allElementRefIds },
    { skip: allElementRefIds.length === 0 },
  );
  const { data: elementAudits = [] } = useGetLatestLogisticsAuditsQuery(
    { refType: 'element', refIds: allElementRefIds },
    { skip: allElementRefIds.length === 0 },
  );

  const notesByRef = useMemo(() => {
    const map = new Map<string, LogisticsNoteResponse>();
    for (const n of [...taskNotes, ...jobNotes, ...elementNotes]) {
      const key = `${n.refType}:${n.refId}`;
      const existing = map.get(key);
      if (!existing || existing.createdAt < n.createdAt) {
        map.set(key, n);
      }
    }
    return map;
  }, [taskNotes, jobNotes, elementNotes]);

  const auditsByRef = useMemo(() => {
    const map = new Map<string, LogisticsAuditResponse>();
    for (const a of [...taskAudits, ...jobAudits, ...elementAudits]) {
      map.set(`${a.refType}:${a.refId}`, a);
    }
    return map;
  }, [taskAudits, jobAudits, elementAudits]);

  // Hydrate actualAt from audits when the underlying entity doesn't carry
  // a "did-this-action-at" timestamp. Today this only matters for ST
  // departures: the engine has no `dispatchedAt` field, so the user-visible
  // "heure effective" comes from the latest audit on the task.
  const hydratedMovements = useMemo(
    () =>
      allMovements.map((m) => {
        if (m.actualAt !== null || !m.isCompleted) return m;
        const audit = auditsByRef.get(`${m.refType}:${m.refId}`);
        return audit ? { ...m, actualAt: new Date(audit.occurredAt) } : m;
      }),
    [allMovements, auditsByRef],
  );

  const filteredMovements = useMemo(
    () => hydratedMovements.filter((m) => dateMatchesDay(m, selectedDate, now)),
    [hydratedMovements, selectedDate, now],
  );

  const reliquat = useMemo(
    () =>
      hydratedMovements.filter((m) => {
        if (m.isCompleted) return false;
        if (m.scheduledAt === null) return false;
        return m.scheduledAt < startOfDay(now);
      }),
    [hydratedMovements, now],
  );

  const arrivals = filteredMovements.filter((m) => m.kind === 'arrival');
  const departures = filteredMovements.filter((m) => m.kind === 'departure');

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleCheck = useCallback(
    async (m: Movement) => {
      const transition = computeTransition(m);
      if (transition === null) return;
      if (m.type === 'st' && transition.status !== undefined) {
        await updateSTStatus({ taskId: m.refId, status: transition.status });
      } else if (m.type === 'client' && m.jobInternalId !== undefined) {
        await toggleJobShipped({ jobInternalId: m.jobInternalId, shipped: !m.isCompleted });
      } else if ((m.type === 'paper' || m.type === 'forme') && m.elementId && m.prerequisiteColumn) {
        const parentJob = jobs.find((j) => j.elements.some((e) => e.id === m.elementId));
        await updateElementPrerequisite({
          elementId: m.elementId,
          jobId: parentJob?.internalId ?? '',
          column: m.prerequisiteColumn,
          value: m.isCompleted ? 'ordered' : 'delivered',
        });
      }
      await createAudit({
        refType: m.refType,
        refId: m.refId,
        action: transition.action,
        actorName,
      });
    },
    [updateSTStatus, toggleJobShipped, updateElementPrerequisite, jobs, createAudit, actorName],
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-flux-base flex flex-col">
      <header className="border-b border-flux-border px-6 py-4">
        <h1 className="text-xl font-semibold text-flux-text-primary">Expéditions</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between gap-6 flex-wrap mb-5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedDate((prev) => { const d = new Date(prev); d.setDate(d.getDate() - 1); return d; })}
              className="w-8 h-8 inline-flex items-center justify-center rounded border border-flux-border text-flux-text-secondary hover:bg-flux-hover hover:text-flux-text-primary transition-colors"
              title="Jour précédent"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(startOfDay(new Date()))}
              className="px-3 py-1.5 text-sm rounded border border-flux-border text-flux-text-primary hover:bg-flux-hover transition-colors min-w-[200px] text-center"
              title="Revenir à aujourd'hui"
            >
              {formatDateLabel(selectedDate, now)}
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate((prev) => { const d = new Date(prev); d.setDate(d.getDate() + 1); return d; })}
              className="w-8 h-8 inline-flex items-center justify-center rounded border border-flux-border text-flux-text-secondary hover:bg-flux-hover hover:text-flux-text-primary transition-colors"
              title="Jour suivant"
            >
              <ChevronRight size={16} />
            </button>
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
          />
        </div>
      </main>
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
        <div className="bg-flux-elevated border border-flux-border rounded-md text-center text-flux-text-muted text-xs italic py-32">
          Aucun mouvement
        </div>
      ) : (
        <div className="bg-flux-elevated border border-flux-border rounded-md overflow-hidden" data-testid={`logistics-column-${title.toLowerCase()}`}>
          <div
            className="grid items-center gap-3 px-3.5 py-1.5 text-[10px] uppercase tracking-wider text-flux-text-muted font-semibold border-b border-flux-border bg-flux-surface"
            style={{ gridTemplateColumns: '92px 84px 76px 1fr auto' }}
          >
            <div>Prévu</div>
            <div>Fait</div>
            <div>Type</div>
            <div>Mouvement</div>
            <div className="w-[68px]" />
          </div>
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
}

function MovementRow({ movement, hasNote, audit, onCheck, onToggleComment }: MovementRowProps) {
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

  // Reuse the 3-state visual vocabulary of the Flux dashboard's ST column
  // (pending=gray empty circle, progress=orange filled dot, done=green
  // check-circle). Same icon component, same .st-* color classes — keeps
  // the warehouse staff's mental model consistent across screens.
  const stateIcon = (() => {
    if (movement.type === 'client' || movement.type === 'paper' || movement.type === 'forme') {
      return movement.isCompleted ? <DoneIcon /> : <PendingIcon />;
    }
    if (movement.stStatus === 'progress') return <ProgressIcon />;
    if (movement.stStatus === 'done') return <DoneIcon />;
    return <PendingIcon />;
  })();
  const stateColorClass = (() => {
    if (movement.type === 'client' || movement.type === 'paper' || movement.type === 'forme') {
      return movement.isCompleted ? 'st-done' : 'st-pending';
    }
    if (movement.stStatus === 'progress') return 'st-progress';
    if (movement.stStatus === 'done') return 'st-done';
    return 'st-pending';
  })();

  const checkTitle = movement.isCompleted
    ? audit
      ? `Effectué — ${formatAuditTooltip(audit)}\nClic = annuler`
      : 'Effectué (clic pour annuler)'
    : isLocked
      ? movement.kind === 'arrival'
        ? 'Le départ n\'a pas encore été effectué'
        : 'Cette tâche est déjà revenue'
      : 'Marquer comme effectué';

  const timeDisplay = isOverdue && movement.scheduledAt
    ? `J-${overdueDays} ${formatTimeOfDay(movement.scheduledAt, '')}`
    : formatPlannedTime(movement.scheduledAt, today, movement.time || '—');

  const overdueDate = movement.scheduledAt
    ? `${String(movement.scheduledAt.getDate()).padStart(2, '0')}/${String(movement.scheduledAt.getMonth() + 1).padStart(2, '0')}`
    : '';
  const overdueHour = movement.scheduledAt
    ? `${String(movement.scheduledAt.getHours()).padStart(2, '0')}h`
    : '';

  const actualDisplay = formatActualTime(movement.actualAt, today);

  return (
    <div
      className={`grid items-center gap-3 px-3.5 py-2.5 transition-colors ${rowClass}`}
      style={{ gridTemplateColumns: '92px 84px 76px 1fr auto' }}
      data-testid={`logistics-movement-${movement.id}`}
      data-completed={movement.isCompleted ? 'true' : 'false'}
      data-kind={movement.kind}
      data-type={movement.type}
    >
      <div className={`text-sm tabular-nums ${isOverdue ? 'text-red-400 font-semibold' : movement.isCompleted ? 'text-flux-text-tertiary' : 'text-flux-text-secondary'}`}>
        {timeDisplay}
      </div>
      <div className={`text-sm tabular-nums ${movement.actualAt !== null ? 'text-emerald-300 font-semibold' : 'text-flux-text-muted'}`}>
        {actualDisplay}
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
      <div className="flex items-center gap-1">
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
          className={`inline-flex items-center justify-center w-6 h-6 shrink-0 bg-transparent border-0 p-0 ${stateColorClass} ${
            isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:brightness-125'
          }`}
          title={checkTitle}
          aria-label={checkTitle}
          data-testid={`logistics-check-${movement.id}`}
        >
          {stateIcon}
        </button>
      </div>
    </div>
  );
}

