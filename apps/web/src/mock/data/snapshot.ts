import type { ScheduleSnapshot } from '../../types';
import {
  generateStations,
  generateProviders,
  generateCategories,
  generateAllGroups,
  generateJobs,
  generateAssignments,
} from '../generators';

let cachedSnapshot: ScheduleSnapshot | null = null;

export function generateMockSnapshot(startDate: Date = new Date()): ScheduleSnapshot {
  // Generate station infrastructure
  const categories = generateCategories();
  const groups = generateAllGroups();
  const stations = generateStations();
  const providers = generateProviders();

  // Generate jobs (includes tasks)
  const jobsData = generateJobs(12, startDate);
  const jobs = jobsData.map((j) => j.job);

  // Generate assignments for assigned tasks
  const assignments = generateAssignments({
    jobs,
    stations,
    providers,
    startDate,
  });

  // Detect late jobs (simplified logic)
  const lateJobs = jobs
    .filter(job => {
      if (job.status === 'Completed' || job.status === 'Cancelled') return false;
      const deadline = new Date(job.workshopExitDate);
      // Simple check: if deadline is within 3 days and not fully scheduled
      const now = new Date();
      const daysUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return daysUntilDeadline < 3 && !job.fullyScheduled;
    })
    .map(job => ({
      jobId: job.id,
      reference: job.reference,
      workshopExitDate: job.workshopExitDate,
      expectedCompletion: new Date(new Date(job.workshopExitDate).getTime() + 24 * 60 * 60 * 1000).toISOString(),
      delayHours: 24,
    }));

  return {
    snapshotVersion: 1,
    generatedAt: new Date().toISOString(),
    stations,
    providers,
    categories,
    groups,
    jobs,
    assignments,
    conflicts: [], // No conflicts in mock data initially
    lateJobs,
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
