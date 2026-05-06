import { useCallback, useMemo, useState } from 'react';
import {
  useGetJobQuery,
  useUpdateJobMutation,
  useUpdateElementSequenceMutation,
  useDeleteElementMutation,
  fluxApi,
  useAppDispatch,
} from '@/store';
import type {
  JobDetailsResponse,
  JobDetailsElement,
  JobDetailsTask,
} from '@/store';
import type { TaskForRemainingDsl } from '@/components/JcfDonePanel/computeRemainingDsl';
import { JcfModificationModal } from './JcfModificationModal';
import type {
  ElementModificationData,
  JobModificationData,
  ModificationChanges,
} from './JcfModificationModal';

/**
 * Bridges Flux/JDP "Modifier" affordances and the Pillar B JCF
 * modification modal. Fetches `GET /jobs/{id}` to seed the per-element
 * cards, then orchestrates the save sequence — sequences first,
 * deletions, then the job-level fields — invalidating Flux/Snapshot
 * caches so the auto-replan picks up the new shape.
 */
export interface JobModificationContainerProps {
  jobInternalId: string;
  onClose: () => void;
}

export function JobModificationContainer({
  jobInternalId,
  onClose,
}: JobModificationContainerProps) {
  const { data, isLoading, isError } = useGetJobQuery(jobInternalId);
  const [updateJob] = useUpdateJobMutation();
  const [updateElementSequence] = useUpdateElementSequenceMutation();
  const [deleteElement] = useDeleteElementMutation();
  const dispatch = useAppDispatch();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);

  const jobModData: JobModificationData | null = useMemo(
    () => (data ? buildJobModificationData(data) : null),
    [data],
  );

  const handleSave = useCallback(
    async (changes: ModificationChanges) => {
      if (!data) return;
      setSaving(true);
      setError(null);
      try {
        for (const el of changes.elements) {
          await updateElementSequence({
            elementId: el.id,
            dsl: el.dsl,
            commentaires: el.commentaires,
            needsBat: el.needsBat,
            needsPaper: el.needsPaper,
            needsForme: el.needsForme,
            needsPlates: el.needsPlates,
          }).unwrap();
        }
        for (const id of changes.deletedElementIds) {
          await deleteElement(id).unwrap();
        }
        if (Object.keys(changes.job).length > 0) {
          await updateJob({
            jobId: data.id,
            body: stripUntouchedJobFields(changes.job, data),
          }).unwrap();
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
    [data, deleteElement, dispatch, onClose, updateElementSequence, updateJob],
  );

  if (isLoading || !jobModData) {
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
      job={jobModData}
      onSave={handleSave}
      error={error}
      isSaving={isSaving}
    />
  );
}

/**
 * Map a JobDetailsResponse onto the modal's input shape.
 *
 * Tasks are flat in the response ; we re-group them per element via
 * `element.taskIds` so the Done panel can split done / in-progress /
 * future per element. Gate `needsX` flags are derived from the wall
 * status (status !== 'none').
 */
function buildJobModificationData(job: JobDetailsResponse): JobModificationData {
  const tasksById = new Map<string, JobDetailsTask>();
  for (const t of job.tasks) tasksById.set(t.id, t);

  const elements: ElementModificationData[] = job.elements.map(el => ({
    id: el.id,
    name: el.name,
    label: el.label,
    commentaires: null,
    needsBat: el.batStatus !== 'none',
    needsPaper: el.paperStatus !== 'none',
    needsForme: el.formeStatus !== 'none',
    needsPlates: el.plateStatus !== 'none',
    tasks: el.taskIds
      .map(tid => tasksById.get(tid))
      .filter((t): t is JobDetailsTask => t !== undefined)
      .map(elementTaskToDslShape),
  }));

  return {
    id: job.id,
    reference: job.reference,
    client: job.client,
    intitule: job.description,
    quantity: job.quantity,
    referent: job.referent,
    transporteurId: job.shipperId,
    workshopExitDate: job.workshopExitDate,
    batDeadline: job.batDeadline,
    deadlinePriority: job.deadlinePriority,
    requiredJobIds: job.requiredJobIds,
    elements,
  };
}

function elementTaskToDslShape(task: JobDetailsTask): TaskForRemainingDsl {
  return {
    id: task.id,
    sequenceOrder: task.sequenceOrder,
    taskType: task.taskType === 'outsourced' ? 'outsourced' : 'internal',
    status: normalizeTaskStatus(task.status),
    setupMinutes: task.setupMinutes,
    runMinutes: task.runMinutes,
    durationOpenDays: task.durationOpenDays,
    actionType: task.actionType,
    comment: task.comment,
  };
}

function normalizeTaskStatus(
  raw: string,
): TaskForRemainingDsl['status'] {
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
  referent: string | null;
  shipperId: string | null;
  workshopExitDate: string | null;
  batDeadline: string | null;
  deadlinePriority: number;
  description: string;
}> {
  const out: ReturnType<typeof stripUntouchedJobFields> = {};
  if (patch.referent !== undefined && patch.referent !== source.referent) {
    out.referent = patch.referent;
  }
  if (
    patch.transporteurId !== undefined &&
    patch.transporteurId !== source.shipperId
  ) {
    out.shipperId = patch.transporteurId;
  }
  if (
    patch.workshopExitDate !== undefined &&
    patch.workshopExitDate !== source.workshopExitDate
  ) {
    out.workshopExitDate = patch.workshopExitDate;
  }
  if (
    patch.batDeadline !== undefined &&
    patch.batDeadline !== source.batDeadline
  ) {
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
  return out;
}
