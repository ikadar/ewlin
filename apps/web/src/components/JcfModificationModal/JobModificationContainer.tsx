import { useCallback, useMemo, useState } from 'react';
import {
  useGetJobQuery,
  useGetSnapshotQuery,
  useUpdateJobMutation,
  useUpdateElementSequenceMutation,
  useDeleteElementMutation,
  fluxApi,
  useAppDispatch,
} from '@/store';
import type {
  JobDetailsResponse,
  JobDetailsTask,
} from '@/store';
import type {
  TaskForRemainingDsl,
  TaskStatus,
} from '@/components/JcfDonePanel/computeRemainingDsl';
import { computeRemainingDsl } from '@/components/JcfDonePanel/computeRemainingDsl';
import type {
  JcfElement,
  SequenceDonePanelData,
} from '@/components/JcfElementsTable';
import { useToast } from '@/hooks/useToast';
import { JcfModificationModal } from './JcfModificationModal';
import type {
  JobModificationData,
  ModificationChanges,
} from './JcfModificationModal';

/**
 * Bridges the Flux "Modifier" affordance and the JCF modification
 * modal. Fetches `GET /jobs/{id}` for the full job detail (header +
 * elements + tasks with statuses), maps it onto the shared JCF shape
 * consumed by the modal, then orchestrates Pillar B save mutations
 * when the user commits :
 *
 *   - PUT /elements/{id}/sequence  (per element with diff)
 *   - DELETE /elements/{id}        (for elements removed from the table)
 *   - PUT /jobs/{id}               (header diff)
 *
 * Cache invalidation : Snapshot tag is invalidated by each mutation,
 * Flux tag is invalidated explicitly so the dashboard reflects the new
 * shape immediately.
 */
export interface JobModificationContainerProps {
  jobInternalId: string;
  onClose: () => void;
}

export function JobModificationContainer({
  jobInternalId,
  onClose,
}: JobModificationContainerProps) {
  const { data: job, isLoading, isError } = useGetJobQuery(jobInternalId);
  const { data: snapshot } = useGetSnapshotQuery();
  const [updateJob] = useUpdateJobMutation();
  const [updateElementSequence] = useUpdateElementSequenceMutation();
  const [deleteElement] = useDeleteElementMutation();
  const dispatch = useAppDispatch();
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);

  // Lookup tables derived from snapshot — needed because JobDetailsTask
  // carries stationId / providerId, but the DSL renderer wants names.
  const stationNameById = useMemo(() => {
    const map = new Map<string, string>();
    snapshot?.stations.forEach(s => map.set(s.id, s.name));
    return map;
  }, [snapshot]);
  const providerNameById = useMemo(() => {
    const map = new Map<string, string>();
    snapshot?.providers?.forEach(p => map.set(p.id, p.name));
    return map;
  }, [snapshot]);

  const jobSuggestions = useMemo(
    () =>
      snapshot?.jobs.map(j => ({ reference: j.reference, client: j.client })) ?? [],
    [snapshot],
  );

  const modificationData: JobModificationData | null = useMemo(() => {
    if (!job) return null;
    return buildModificationData(job, {
      stationNameById,
      providerNameById,
      jobSuggestions,
    });
  }, [job, stationNameById, providerNameById, jobSuggestions]);

  const handleSave = useCallback(
    async (changes: ModificationChanges) => {
      if (!job) return;
      setSaving(true);
      setError(null);
      try {
        // 1) Per-element sequence + gate + prerequisite edits.
        const elementIdByName = new Map(job.elements.map(e => [e.name, e.id]));

        for (const el of changes.elements) {
          // Resolve precedence names → ids. Collect unknowns explicitly so a
          // typo doesn't silently drop the precedence link (which used to be
          // the previous behaviour). Surface the failure before any mutation
          // fires so partial-save states don't happen.
          const requestedNames = el.precedences
            .split(',')
            .map(n => n.trim())
            .filter(Boolean);
          const prerequisiteElementIds: string[] = [];
          const unknownNames: string[] = [];
          for (const name of requestedNames) {
            const id = elementIdByName.get(name);
            if (id != null) prerequisiteElementIds.push(id);
            else unknownNames.push(name);
          }
          if (unknownNames.length > 0) {
            throw new Error(
              `Précédences inconnues sur l'élément "${el.name}" : ${unknownNames.join(', ')}. ` +
              `Vérifie l'orthographe — les noms doivent correspondre exactement aux éléments du job.`
            );
          }

          await updateElementSequence({
            elementId: el.dbId,
            dsl: el.sequenceDsl,
            commentaires: el.commentaires,
            needsBat: el.needsBat,
            needsPaper: el.needsPaper,
            needsForme: el.needsForme,
            needsPlates: el.needsPlates,
            prerequisiteElementIds,
          }).unwrap();
        }
        // 2) Element deletions.
        for (const id of changes.deletedElementIds) {
          await deleteElement(id).unwrap();
        }
        // 3) Job-level diff — only pass fields the user actually changed.
        const jobPatch = stripUntouchedJobFields(changes.job, job);
        if (Object.keys(jobPatch).length > 0) {
          await updateJob({
            jobId: job.id,
            body: jobPatch,
          }).unwrap();
        }
        // 4) Surface the V1 limitation (newly-added rows aren't persisted).
        if (changes.unsavedNewElements.length > 0) {
          showToast(
            `Élément(s) ajouté(s) non enregistré(s) en V1 : ${changes.unsavedNewElements.join(', ')}`,
            'info',
          );
        }
        dispatch(fluxApi.util.invalidateTags(['FluxJobs']));
        onClose();
      } catch (e) {
        const status = (e as { status?: number })?.status;
        const msg =
          status === 410
            ? 'Élément supprimé entre-temps. Recharge la page.'
            : status === 400
              ? 'DSL invalide ou champs incohérents. Vérifie ton entrée.'
              : 'Erreur côté serveur. Réessaie ou contacte un admin.';
        setError(msg);
      } finally {
        setSaving(false);
      }
    },
    [
      job,
      deleteElement,
      dispatch,
      onClose,
      updateElementSequence,
      updateJob,
      showToast,
    ],
  );

  if (isLoading || !modificationData) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        data-testid="jcf-modification-loading"
      >
        <div className="text-zinc-300 text-xs">
          {isError ? 'Erreur de chargement du job.' : 'Chargement…'}
        </div>
      </div>
    );
  }

  return (
    <JcfModificationModal
      isOpen
      onClose={onClose}
      job={modificationData}
      fullJob={job}
      onSave={handleSave}
      error={error}
      isSaving={isSaving}
    />
  );
}

// ── Mappers ────────────────────────────────────────────────────────────────

interface MapperContext {
  stationNameById: Map<string, string>;
  providerNameById: Map<string, string>;
  jobSuggestions: Array<{ reference: string; client: string }>;
}

interface ElementSpecLike {
  format?: string;
  papier?: string;
  pagination?: number;
  imposition?: string;
  impression?: string;
  surfacage?: string;
  quantite?: number;
  qteFeuilles?: number;
  autres?: string;
  commentaires?: string;
}

function buildModificationData(
  job: JobDetailsResponse,
  ctx: MapperContext,
): JobModificationData {
  // Index tasks by id so we can re-group them per element.
  const tasksById = new Map<string, JobDetailsTask>();
  for (const t of job.tasks) tasksById.set(t.id, t);

  // Element name resolution for precedences (DB ids ↔ names).
  const elementNameById = new Map<string, string>();
  job.elements.forEach(el => elementNameById.set(el.id, el.name));

  const elements: JcfElement[] = [];
  const elementDbIdByInitialName: Record<string, string> = {};
  const donePanelByElementName: Record<string, SequenceDonePanelData> = {};

  for (const el of job.elements) {
    const tasks: TaskForRemainingDsl[] = el.taskIds
      .map(tid => tasksById.get(tid))
      .filter((t): t is JobDetailsTask => t != null)
      .map(t => mapTaskForRemainingDsl(t, ctx));

    const remaining = computeRemainingDsl(tasks);
    const spec = (el.spec as ElementSpecLike | null | undefined) ?? {};

    const precedenceNames = el.prerequisiteElementIds
      .map(id => elementNameById.get(id) ?? '')
      .filter(Boolean)
      .join(',');

    elements.push({
      name: el.name,
      precedences: precedenceNames,
      quantite: spec.quantite != null ? String(spec.quantite) : '',
      pagination: spec.pagination != null ? String(spec.pagination) : '',
      format: spec.format ?? '',
      papier: spec.papier ?? '',
      impression: spec.impression ?? '',
      surfacage: spec.surfacage ?? '',
      autres: spec.autres ?? '',
      imposition: spec.imposition ?? '',
      qteFeuilles: spec.qteFeuilles != null ? String(spec.qteFeuilles) : '',
      commentaires: spec.commentaires ?? '',
      sequence: remaining.dsl,
      needsBat: el.batStatus !== 'none',
      needsPaper: el.paperStatus !== 'none',
      needsForme: el.formeStatus !== 'none',
      needsPlates: el.plateStatus !== 'none',
    });
    elementDbIdByInitialName[el.name] = el.id;
    donePanelByElementName[el.name] = {
      completedTasks: remaining.completedTasks,
      inProgressTask: remaining.inProgressTask,
    };
  }

  return {
    id: job.id,
    reference: job.reference,
    client: job.client,
    intitule: job.description,
    quantity: job.quantity != null ? String(job.quantity) : '',
    referent: job.referent ?? '',
    shipperId: job.shipperId ?? '',
    workshopExitDate: job.workshopExitDate ?? '',
    deadlineRelativeDays:
      job.deadlineRelativeWorkingDays != null
        ? String(job.deadlineRelativeWorkingDays)
        : '',
    batDeadline: job.batDeadline ?? '',
    deadlinePriority: job.deadlinePriority,
    requiredJobs: '', // Container could re-resolve job.requiredJobIds → references but kept simple for V1.
    elements,
    elementDbIdByInitialName,
    donePanelByElementName,
    jobSuggestions: ctx.jobSuggestions,
  };
}

function mapTaskForRemainingDsl(
  task: JobDetailsTask,
  ctx: MapperContext,
): TaskForRemainingDsl {
  const isInternal = task.taskType !== 'outsourced';
  return {
    id: task.id,
    sequenceOrder: task.sequenceOrder,
    taskType: isInternal ? 'internal' : 'outsourced',
    status: normalizeTaskStatus(task.status),
    stationName: task.stationId ? ctx.stationNameById.get(task.stationId) ?? null : null,
    providerName: task.providerId ? ctx.providerNameById.get(task.providerId) ?? null : null,
    setupMinutes: task.setupMinutes,
    runMinutes: task.runMinutes,
    durationOpenDays: task.durationOpenDays,
    actionType: task.actionType,
    comment: task.comment,
    recordedProgressPct: task.recordedProgressPct,
    lastSetupAt: task.lastSetupAt,
  };
}

function normalizeTaskStatus(raw: string): TaskStatus {
  switch (raw) {
    case 'completed':
    case 'cancelled':
    case 'ready':
    case 'assigned':
      return raw;
    default:
      return 'defined';
  }
}

/**
 * Drop fields the user didn't touch — JcfModificationModal sends the
 * full set on each save, so we strip back to a real diff to avoid
 * triggering Préprod-fork dirty bits or accidentally clearing
 * intitule/referent/etc.
 */
function stripUntouchedJobFields(
  patch: ModificationChanges['job'],
  source: JobDetailsResponse,
): Partial<{
  client: string;
  referent: string | null;
  shipperId: string | null;
  workshopExitDate: string | null;
  deadlineRelativeWorkingDays: number | null;
  batDeadline: string | null;
  deadlinePriority: number;
  description: string;
  quantity: number;
}> {
  const out: ReturnType<typeof stripUntouchedJobFields> = {};
  if (patch.client !== undefined && patch.client !== source.client) {
    out.client = patch.client;
  }
  if (patch.referent !== undefined && patch.referent !== source.referent) {
    out.referent = patch.referent;
  }
  if (patch.shipperId !== undefined && patch.shipperId !== source.shipperId) {
    out.shipperId = patch.shipperId;
  }
  if (
    patch.workshopExitDate !== undefined &&
    patch.workshopExitDate !== source.workshopExitDate
  ) {
    out.workshopExitDate = patch.workshopExitDate;
  }
  if (
    patch.deadlineRelativeDays !== undefined &&
    patch.deadlineRelativeDays !== source.deadlineRelativeWorkingDays
  ) {
    out.deadlineRelativeWorkingDays = patch.deadlineRelativeDays;
  }
  if (patch.batDeadline !== undefined && patch.batDeadline !== source.batDeadline) {
    out.batDeadline = patch.batDeadline;
  }
  if (
    patch.deadlinePriority !== undefined &&
    patch.deadlinePriority !== source.deadlinePriority
  ) {
    out.deadlinePriority = patch.deadlinePriority;
  }
  if (patch.intitule !== undefined && patch.intitule !== source.description) {
    out.description = patch.intitule;
  }
  if (patch.quantity !== undefined && patch.quantity.trim() !== '') {
    const parsed = parseInt(patch.quantity, 10);
    if (!Number.isNaN(parsed) && parsed !== source.quantity) {
      out.quantity = parsed;
    }
  }
  return out;
}
