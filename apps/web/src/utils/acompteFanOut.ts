import type { Job, AcompteJob, TaskAssignment } from '@flux/types';

const ACOMPTE_SEPARATOR = '#';

export function isAcompteJob(job: Job): job is AcompteJob {
  return '_isAcompteCard' in job && (job as AcompteJob)._isAcompteCard === true;
}

export function getParentJobId(job: Job): string {
  return isAcompteJob(job) ? job._parentJobId : job.id;
}

export function getAcompteIdFromAssignment(assignmentId: string): string | null {
  const idx = assignmentId.indexOf(ACOMPTE_SEPARATOR);
  return idx >= 0 ? assignmentId.slice(idx + 1) : null;
}

function formatAcompteTag(index: number, total: number): string {
  const prefix = index === total ? 'SLD' : 'AC';
  return `[${prefix}.${index}/${total}]`;
}

export function makeSyntheticJobId(parentJobId: string, positionIndex: number): string {
  return `${parentJobId}__ac${positionIndex}`;
}

export function expandJobsForDisplay(jobs: Job[]): (Job | AcompteJob)[] {
  const result: (Job | AcompteJob)[] = [];

  for (const job of jobs) {
    if (!job.acomptes || job.acomptes.length === 0) {
      result.push(job);
      continue;
    }

    const total = job.acomptes.length;
    for (const ac of job.acomptes) {
      const tag = formatAcompteTag(ac.positionIndex, total);
      const syntheticJob: AcompteJob = {
        ...job,
        id: makeSyntheticJobId(job.id, ac.positionIndex),
        reference: `${job.reference}.${ac.positionIndex}`,
        description: `${tag} ${job.description}`,
        workshopExitDate: ac.deadline,
        deadlinePriority: ac.deadlinePriority,
        _isAcompteCard: true,
        _parentJobId: job.id,
        _acompteId: ac.id,
        _acompteIndex: ac.positionIndex,
        _acompteTotal: total,
        _quantityShare: ac.quantityShare,
      };
      result.push(syntheticJob);
    }
  }

  return result;
}

export function buildAcompteAssignmentMap(
  assignments: TaskAssignment[],
  jobs: Job[],
): Map<string, string> {
  const acompteIdToSyntheticJobId = new Map<string, string>();
  for (const job of jobs) {
    if (!job.acomptes) continue;
    for (const ac of job.acomptes) {
      acompteIdToSyntheticJobId.set(ac.id, makeSyntheticJobId(job.id, ac.positionIndex));
    }
  }

  const assignmentToSyntheticJob = new Map<string, string>();
  for (const a of assignments) {
    const acompteId = getAcompteIdFromAssignment(a.id);
    if (acompteId) {
      const syntheticJobId = acompteIdToSyntheticJobId.get(acompteId);
      if (syntheticJobId) {
        assignmentToSyntheticJob.set(a.id, syntheticJobId);
      }
    }
  }

  return assignmentToSyntheticJob;
}
