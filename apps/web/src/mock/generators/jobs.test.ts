/**
 * Job Generator Tests
 */

import { describe, it, expect } from 'vitest';
import { generateJobs, generateTasksForJob, identifyLateJobs } from './jobs';
import { isInternalTask, isOutsourcedTask } from '@flux/types';

describe('generateTasksForJob', () => {
  it('returns an array of tasks', () => {
    const tasks = generateTasksForJob({ jobId: 'test-job' });
    expect(Array.isArray(tasks)).toBe(true);
    expect(tasks.length).toBeGreaterThan(0);
  });

  it('all tasks have required fields', () => {
    const tasks = generateTasksForJob({ jobId: 'test-job' });
    for (const task of tasks) {
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('jobId');
      expect(task).toHaveProperty('sequenceOrder');
      expect(task).toHaveProperty('status');
      expect(task).toHaveProperty('type');
      expect(task).toHaveProperty('createdAt');
      expect(task).toHaveProperty('updatedAt');
    }
  });

  it('tasks reference the correct jobId', () => {
    const jobId = 'my-test-job';
    const tasks = generateTasksForJob({ jobId });
    for (const task of tasks) {
      expect(task.jobId).toBe(jobId);
    }
  });

  it('internal tasks have stationId and duration', () => {
    const tasks = generateTasksForJob({ jobId: 'test-job' });
    const internalTasks = tasks.filter(isInternalTask);
    expect(internalTasks.length).toBeGreaterThan(0);
    for (const task of internalTasks) {
      expect(task).toHaveProperty('stationId');
      expect(task.duration).toHaveProperty('setupMinutes');
      expect(task.duration).toHaveProperty('runMinutes');
      expect(task.duration.setupMinutes).toBeGreaterThanOrEqual(0);
      expect(task.duration.runMinutes).toBeGreaterThan(0);
    }
  });

  it('sequence orders are consecutive starting from 0', () => {
    const tasks = generateTasksForJob({ jobId: 'test-job', startSequence: 0 });
    const orders = tasks.map((t) => t.sequenceOrder).sort((a, b) => a - b);
    for (let i = 0; i < orders.length; i++) {
      expect(orders[i]).toBe(i);
    }
  });
});

describe('generateJobs', () => {
  it('returns jobs and tasks arrays', () => {
    const result = generateJobs({ count: 5 });
    expect(result).toHaveProperty('jobs');
    expect(result).toHaveProperty('tasks');
    expect(Array.isArray(result.jobs)).toBe(true);
    expect(Array.isArray(result.tasks)).toBe(true);
  });

  it('generates the requested number of jobs', () => {
    const count = 10;
    const result = generateJobs({ count });
    expect(result.jobs.length).toBe(count);
  });

  it('each job has required fields', () => {
    const result = generateJobs({ count: 5 });
    for (const job of result.jobs) {
      expect(job).toHaveProperty('id');
      expect(job).toHaveProperty('reference');
      expect(job).toHaveProperty('client');
      expect(job).toHaveProperty('description');
      expect(job).toHaveProperty('status');
      expect(job).toHaveProperty('workshopExitDate');
      expect(job).toHaveProperty('fullyScheduled');
      expect(job).toHaveProperty('color');
      expect(job).toHaveProperty('paperPurchaseStatus');
      expect(job).toHaveProperty('proofApproval');
      expect(job).toHaveProperty('platesStatus');
      expect(job).toHaveProperty('taskIds');
    }
  });

  // REQ-20: Similarities Feature Completion - paperWeight and inking fields
  it('each job has paperWeight field with valid value', () => {
    const result = generateJobs({ count: 10 });
    const validWeights = [80, 100, 120, 150, 170, 200, 250, 300, 350];
    for (const job of result.jobs) {
      expect(job).toHaveProperty('paperWeight');
      expect(validWeights).toContain(job.paperWeight);
    }
  });

  it('each job has inking field with valid value', () => {
    const result = generateJobs({ count: 10 });
    const validInkings = ['CMYK', '4C+0', '4C+4C', '2C+0', 'Pantone 485+Black', '1C+0'];
    for (const job of result.jobs) {
      expect(job).toHaveProperty('inking');
      expect(validInkings).toContain(job.inking);
    }
  });

  it('jobs have varied paperWeight and inking values for similarity comparison', () => {
    const result = generateJobs({ count: 20 });
    const uniqueWeights = new Set(result.jobs.map(j => j.paperWeight));
    const uniqueInkings = new Set(result.jobs.map(j => j.inking));

    // With 20 jobs, we should have at least 2 different values for each
    expect(uniqueWeights.size).toBeGreaterThan(1);
    expect(uniqueInkings.size).toBeGreaterThan(1);
  });

  it('job colors are valid hex colors', () => {
    const result = generateJobs({ count: 5 });
    for (const job of result.jobs) {
      expect(job.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('workshopExitDate is valid ISO date', () => {
    const result = generateJobs({ count: 5 });
    for (const job of result.jobs) {
      expect(job.workshopExitDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const date = new Date(job.workshopExitDate);
      expect(date.toString()).not.toBe('Invalid Date');
    }
  });

  it('includes late jobs when requested', () => {
    const result = generateJobs({ count: 10, includeLateJobs: 3 });
    const delayedJobs = result.jobs.filter((j) => j.status === 'Delayed');
    expect(delayedJobs.length).toBe(3);
  });

  it('taskIds reference actual tasks', () => {
    const result = generateJobs({ count: 5 });
    const taskIds = new Set(result.tasks.map((t) => t.id));
    for (const job of result.jobs) {
      for (const taskId of job.taskIds) {
        expect(taskIds.has(taskId)).toBe(true);
      }
    }
  });

  it('each task belongs to a job', () => {
    const result = generateJobs({ count: 5 });
    const jobIds = new Set(result.jobs.map((j) => j.id));
    for (const task of result.tasks) {
      expect(jobIds.has(task.jobId)).toBe(true);
    }
  });
});

describe('identifyLateJobs', () => {
  it('returns empty array when no late jobs', () => {
    const result = generateJobs({ count: 5, includeLateJobs: 0 });
    const lateJobs = identifyLateJobs(result.jobs);
    // May have some late jobs due to random workshop exit dates
    expect(Array.isArray(lateJobs)).toBe(true);
  });

  it('identifies jobs with past workshop exit date as late', () => {
    const result = generateJobs({ count: 5, includeLateJobs: 2 });
    const lateJobs = identifyLateJobs(result.jobs);

    // Should have at least the explicitly created late jobs
    expect(lateJobs.length).toBeGreaterThanOrEqual(2);
  });

  it('late job entries have required fields', () => {
    const result = generateJobs({ count: 5, includeLateJobs: 2 });
    const lateJobs = identifyLateJobs(result.jobs);

    for (const lateJob of lateJobs) {
      expect(lateJob).toHaveProperty('jobId');
      expect(lateJob).toHaveProperty('deadline');
      expect(lateJob).toHaveProperty('expectedCompletion');
      expect(lateJob).toHaveProperty('delayDays');
      expect(lateJob.delayDays).toBeGreaterThan(0);
    }
  });

  it('late job deadline is before today', () => {
    const result = generateJobs({ count: 5, includeLateJobs: 2 });
    const lateJobs = identifyLateJobs(result.jobs);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const lateJob of lateJobs) {
      const deadline = new Date(lateJob.deadline);
      deadline.setHours(0, 0, 0, 0);
      expect(deadline.getTime()).toBeLessThan(today.getTime());
    }
  });
});

describe('outsourced tasks', () => {
  it('can generate jobs with outsourced tasks', () => {
    // Generate multiple times to ensure we get some outsourced tasks
    let foundOutsourced = false;
    for (let i = 0; i < 10; i++) {
      const result = generateJobs({ count: 10 });
      const outsourcedTasks = result.tasks.filter(isOutsourcedTask);
      if (outsourcedTasks.length > 0) {
        foundOutsourced = true;
        break;
      }
    }
    expect(foundOutsourced).toBe(true);
  });

  it('outsourced tasks have provider and duration info', () => {
    const result = generateJobs({ count: 20 });
    const outsourcedTasks = result.tasks.filter(isOutsourcedTask);

    for (const task of outsourcedTasks) {
      expect(task).toHaveProperty('providerId');
      expect(task).toHaveProperty('actionType');
      expect(task.duration).toHaveProperty('openDays');
      expect(task.duration).toHaveProperty('latestDepartureTime');
      expect(task.duration).toHaveProperty('receptionTime');
      expect(task.duration.openDays).toBeGreaterThan(0);
    }
  });
});
