import type { ScheduleSnapshot, OutsourcedTask, OutsourcedProvider } from '@flux/types';
import { louisBaseSnapshot, today } from './shared-louis';
import { generateLouisJobs } from './generators-louis';

// Outsourced provider for L-00010 pelliculage task
const pelliProvider: OutsourcedProvider = {
  id: 'provider-pelli',
  name: 'Pelli Express',
  status: 'Active',
  supportedActionTypes: ['Pelliculage'],
  latestDepartureTime: '14:00',
  receptionTime: '09:00',
  transitDays: 1,
  groupId: 'grp-outsourced-pelli',
};

export function createLouisPhase1Fixture(): ScheduleSnapshot {
  const { jobs, elements, tasks } = generateLouisJobs(10);
  const base = louisBaseSnapshot();

  // --- Post-process: add outsourced element before FINITION on L-00010 (job-00010) ---
  const jobId = 'job-00010';
  const finElemId = `elem-${jobId}-fin`;
  const outElemId = `elem-${jobId}-pelli`;
  const outTaskId = `task-${jobId}-outsourced-pelli`;

  // 1. Create the outsourced task
  const outTask: OutsourcedTask = {
    id: outTaskId,
    elementId: outElemId,
    sequenceOrder: 0,
    status: 'Ready',
    type: 'Outsourced',
    providerId: pelliProvider.id,
    actionType: 'Pelliculage',
    duration: {
      openDays: 2,
      latestDepartureTime: '14:00',
      receptionTime: '09:00',
    },
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  };
  tasks.push(outTask);

  // 2. Create the outsourced element (prerequisite: all 3 print elements, same as FINITION had)
  const finElem = elements.find((e) => e.id === finElemId)!;
  const printPrereqs = [...finElem.prerequisiteElementIds]; // [couv, cah1, cah2]

  const finElemIdx = elements.indexOf(finElem);
  elements.splice(finElemIdx, 0, {
    id: outElemId,
    jobId,
    name: 'Pelliculage (ext.)',
    prerequisiteElementIds: printPrereqs,
    taskIds: [outTaskId],
    paperStatus: 'none',
    batStatus: 'none',
    plateStatus: 'none',
    formeStatus: 'none',
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  });

  // 3. Update FINITION prerequisiteElementIds: add outsourced element (keep print elements too)
  finElem.prerequisiteElementIds = [...printPrereqs, outElemId];

  // 4. Update job: add new element and task references
  const job = jobs.find((j) => j.id === jobId)!;
  job.elementIds.splice(job.elementIds.indexOf(finElemId), 0, outElemId);
  const firstFinTaskId = finElem.taskIds[0];
  job.taskIds.splice(job.taskIds.indexOf(firstFinTaskId), 0, outTaskId);

  return {
    ...base,
    providers: [pelliProvider],
    groups: [
      ...base.groups,
      { id: 'grp-outsourced-pelli', name: 'Pelliculage (ext.)', maxConcurrent: 999, isOutsourcedProviderGroup: true },
    ],
    jobs,
    elements,
    tasks,
    assignments: [],
    conflicts: [],
    lateJobs: [],
  };
}
