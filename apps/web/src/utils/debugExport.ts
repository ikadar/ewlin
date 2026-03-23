import type { ScheduleSnapshot } from '@flux/types';

export function buildDebugPayload(snapshot: ScheduleSnapshot) {
  const assignedTaskIds = new Set(snapshot.assignments.map(a => a.taskId));
  const completedCount = snapshot.assignments.filter(a => a.isCompleted).length;

  const splitGroupIds = new Set<string>();
  let splitParts = 0;
  for (const task of snapshot.tasks) {
    if ('splitGroupId' in task && task.splitGroupId) {
      splitGroupIds.add(task.splitGroupId);
      splitParts++;
    }
  }

  return {
    _debugSummary: {
      exportedAt: new Date().toISOString(),
      snapshotVersion: snapshot.version,
      snapshotGeneratedAt: snapshot.generatedAt,
      counts: {
        jobs: snapshot.jobs.length,
        elements: snapshot.elements.length,
        tasks: snapshot.tasks.length,
        assignments: snapshot.assignments.length,
        stations: snapshot.stations.length,
        categories: snapshot.categories.length,
        groups: snapshot.groups.length,
        providers: snapshot.providers.length,
        conflicts: snapshot.conflicts.length,
        lateJobs: snapshot.lateJobs.length,
      },
      placementStats: {
        totalTasks: snapshot.tasks.length,
        placedTasks: assignedTaskIds.size,
        unplacedTasks: snapshot.tasks.length - assignedTaskIds.size,
        completedTasks: completedCount,
      },
      splitStats: {
        splitGroups: splitGroupIds.size,
        splitParts,
      },
    },
    snapshot,
  };
}
