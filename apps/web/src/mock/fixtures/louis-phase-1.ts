import type { ScheduleSnapshot } from '@flux/types';
import { louisBaseSnapshot } from './shared-louis';
import { generateLouisJobs } from './generators-louis';

export function createLouisPhase1Fixture(): ScheduleSnapshot {
  const { jobs, elements, tasks } = generateLouisJobs(10);
  return {
    ...louisBaseSnapshot(),
    jobs,
    elements,
    tasks,
    assignments: [],
    conflicts: [],
    lateJobs: [],
  };
}
