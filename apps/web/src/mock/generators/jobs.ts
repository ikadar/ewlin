import { faker } from '@faker-js/faker';
import { addDays, addHours } from 'date-fns';
import type { Job, Task, JobStatus, TaskStatus } from '../../types';

const JOB_PREFIXES = ['PRJ', 'ORD', 'WO', 'MFG', 'ASM'];
const TASK_TYPES = ['CNC', 'Milling', 'Turning', 'Cutting', 'Assembly', 'QC', 'Painting', 'Welding', 'Testing', 'Packaging'];

export interface GeneratedJobWithTasks {
  job: Job;
  tasks: Task[];
}

export function generateJobs(
  count: number = 10,
  startDate: Date = new Date()
): GeneratedJobWithTasks[] {
  const results: GeneratedJobWithTasks[] = [];

  for (let i = 0; i < count; i++) {
    const jobId = faker.string.uuid();
    const prefix = faker.helpers.arrayElement(JOB_PREFIXES);
    const number = faker.number.int({ min: 1000, max: 9999 });

    const status: JobStatus = faker.helpers.weightedArrayElement([
      { weight: 10, value: 'Draft' as const },
      { weight: 40, value: 'Planned' as const },
      { weight: 30, value: 'InProgress' as const },
      { weight: 5, value: 'Delayed' as const },
      { weight: 10, value: 'Completed' as const },
      { weight: 5, value: 'Cancelled' as const },
    ]);

    const deadlineDays = faker.number.int({ min: 3, max: 21 });

    const job: Job = {
      id: jobId,
      name: `${prefix}-${number}`,
      description: faker.commerce.productDescription(),
      deadline: addDays(startDate, deadlineDays).toISOString(),
      status,
    };

    // Generate 2-6 tasks per job
    const taskCount = faker.number.int({ min: 2, max: 6 });
    const tasks = generateTasksForJob(jobId, taskCount, status);

    results.push({ job, tasks });
  }

  return results;
}

function generateTasksForJob(jobId: string, count: number, jobStatus: JobStatus): Task[] {
  const tasks: Task[] = [];
  const taskIds: string[] = [];

  for (let i = 0; i < count; i++) {
    const taskId = faker.string.uuid();
    taskIds.push(taskId);

    // First task has no dependencies, others might depend on previous tasks
    const dependencies: string[] = [];
    if (i > 0) {
      // 70% chance to depend on the previous task
      if (faker.datatype.boolean(0.7)) {
        dependencies.push(taskIds[i - 1]);
      }
      // 30% chance to also depend on an earlier task
      if (i > 1 && faker.datatype.boolean(0.3)) {
        const earlierIdx = faker.number.int({ min: 0, max: i - 2 });
        if (!dependencies.includes(taskIds[earlierIdx])) {
          dependencies.push(taskIds[earlierIdx]);
        }
      }
    }

    let taskStatus: TaskStatus;
    if (jobStatus === 'Draft') {
      taskStatus = 'Defined';
    } else if (jobStatus === 'Completed') {
      taskStatus = 'Completed';
    } else if (jobStatus === 'Cancelled') {
      taskStatus = faker.helpers.arrayElement(['Completed', 'Cancelled']);
    } else {
      taskStatus = faker.helpers.weightedArrayElement([
        { weight: 10, value: 'Defined' as const },
        { weight: 20, value: 'Ready' as const },
        { weight: 30, value: 'Assigned' as const },
        { weight: 20, value: 'Executing' as const },
        { weight: 15, value: 'Completed' as const },
        { weight: 3, value: 'Failed' as const },
        { weight: 2, value: 'Cancelled' as const },
      ]);
    }

    tasks.push({
      id: taskId,
      jobId,
      type: faker.helpers.arrayElement(TASK_TYPES),
      duration: faker.helpers.arrayElement([30, 60, 90, 120, 180, 240, 300, 480]), // minutes
      requiresOperator: faker.datatype.boolean(0.85),
      requiresEquipment: faker.datatype.boolean(0.9),
      dependencies,
      status: taskStatus,
    });
  }

  return tasks;
}
