import type { ScheduleSnapshot, OutsourcedTask, OutsourcedProvider } from '@flux/types';
import { louisBaseSnapshot, today } from './shared-louis';
import { generateLouisJobs } from './generators-louis';

// Outsourced provider for L-00010 DCC task
const dccProvider: OutsourcedProvider = {
    id: 'provider-dcc',
    name: 'Clément',
    status: 'Active',
    supportedActionTypes: ['Reliure dos carré collé'],
    latestDepartureTime: '14:00',
    receptionTime: '09:00',
    transitDays: 3,
    groupId: 'grp-outsourced-dcc',
};

export function createLouisPhase1Fixture(): ScheduleSnapshot {
    const { jobs, elements, tasks } = generateLouisJobs(10);
    const base = louisBaseSnapshot();

    // --- Post-process: replace FINITION tasks with outsourced DCC on L-00010 (job-00010) ---
    const jobId = 'job-00010';
    const finElemId = `elem-${jobId}-fin`;
    const dccTaskId = `task-${jobId}-outsourced-dcc`;

    // 1. Create the outsourced DCC task
    const dccTask: OutsourcedTask = {
        id: dccTaskId,
        elementId: finElemId,
        sequenceOrder: 0,
        status: 'Ready',
        type: 'Outsourced',
        providerId: dccProvider.id,
        actionType: 'Reliure dos carré collé',
        duration: {
            openDays: 3,
            latestDepartureTime: '14:00',
            receptionTime: '09:00',
        },
        createdAt: today.toISOString(),
        updatedAt: today.toISOString(),
    };

    // 2. Remove old FINITION tasks from the tasks array and replace with DCC task
    const finElem = elements.find((e) => e.id === finElemId)!;
    const oldFinTaskIds = new Set(finElem.taskIds);
    const job = jobs.find((j) => j.id === jobId)!;

    // Remove old finition tasks from global tasks array
    for (let i = tasks.length - 1; i >= 0; i--) {
        if (oldFinTaskIds.has(tasks[i].id)) tasks.splice(i, 1);
    }
    tasks.push(dccTask);

    // 3. Update FINITION element to only reference the DCC task
    finElem.taskIds = [dccTaskId];

    // 4. Update job taskIds: remove old finition tasks, add DCC task
    job.taskIds = job.taskIds.filter((id) => !oldFinTaskIds.has(id));
    job.taskIds.push(dccTaskId);

    return {
        ...base,
        providers: [dccProvider],
        groups: [
            ...base.groups,
            { id: 'grp-outsourced-dcc', name: 'Reliure DCC (ext.)', maxConcurrent: 999, isOutsourcedProviderGroup: true },
        ],
        jobs,
        elements,
        tasks,
        assignments: [],
        conflicts: [],
        lateJobs: [],
    };
}