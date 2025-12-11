import type { ScheduleSnapshot } from '../../types';
import {
  generateOperators,
  generateEquipment,
  generateJobs,
  generateAssignments,
} from '../generators';

let cachedSnapshot: ScheduleSnapshot | null = null;

export function generateMockSnapshot(startDate: Date = new Date()): ScheduleSnapshot {
  // Generate equipment first (operators need equipment IDs for skills)
  const equipment = generateEquipment(15, startDate);
  const equipmentIds = equipment.map((e) => e.id);

  // Generate operators with skills for the equipment
  const operators = generateOperators(20, equipmentIds, startDate);

  // Generate jobs and tasks
  const jobsWithTasks = generateJobs(12, startDate);
  const jobs = jobsWithTasks.map((j) => j.job);
  const tasks = jobsWithTasks.flatMap((j) => j.tasks);

  // Generate assignments for assigned/executing tasks
  const assignments = generateAssignments({
    tasks,
    operators,
    equipment,
    startDate,
  });

  return {
    assignments,
    operators,
    equipment,
    tasks,
    jobs,
    snapshotVersion: 1,
    generatedAt: new Date().toISOString(),
  };
}

export function getMockSnapshot(startDate?: Date): ScheduleSnapshot {
  if (!cachedSnapshot) {
    cachedSnapshot = generateMockSnapshot(startDate);
  }
  return cachedSnapshot;
}

export function resetMockSnapshot(): void {
  cachedSnapshot = null;
}

export function updateMockSnapshot(updater: (snapshot: ScheduleSnapshot) => ScheduleSnapshot): ScheduleSnapshot {
  if (!cachedSnapshot) {
    cachedSnapshot = generateMockSnapshot();
  }
  cachedSnapshot = updater(cachedSnapshot);
  cachedSnapshot.snapshotVersion++;
  cachedSnapshot.generatedAt = new Date().toISOString();
  return cachedSnapshot;
}
