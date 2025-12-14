import { describe, it, expect } from 'vitest';
import { jobFactory } from '../jobFactory';

describe('jobFactory', () => {
  describe('createMany', () => {
    it('returns an array of jobs', () => {
      const jobs = jobFactory.createMany();
      expect(Array.isArray(jobs)).toBe(true);
      expect(jobs.length).toBe(10); // default count
    });

    it('respects count option', () => {
      const jobs = jobFactory.createMany({ count: 5 });
      expect(jobs.length).toBe(5);
    });

    it('each job has required fields', () => {
      const jobs = jobFactory.createMany({ count: 3 });
      for (const job of jobs) {
        expect(job).toHaveProperty('id');
        expect(job).toHaveProperty('reference');
        expect(job).toHaveProperty('client');
        expect(job).toHaveProperty('status');
        expect(job).toHaveProperty('tasks');
        expect(Array.isArray(job.tasks)).toBe(true);
      }
    });
  });

  describe('createOne', () => {
    it('returns a single job', () => {
      const job = jobFactory.createOne();
      expect(job).toHaveProperty('id');
      expect(job).toHaveProperty('reference');
      expect(job).toHaveProperty('tasks');
    });
  });

  describe('extractTasks', () => {
    it('extracts all tasks from jobs', () => {
      const jobs = jobFactory.createMany({ count: 3 });
      const tasks = jobFactory.extractTasks(jobs);

      const expectedCount = jobs.reduce((sum, job) => sum + job.tasks.length, 0);
      expect(tasks.length).toBe(expectedCount);
    });

    it('returns empty array for empty jobs', () => {
      const tasks = jobFactory.extractTasks([]);
      expect(tasks).toEqual([]);
    });
  });

  describe('extractUnassignedTasks', () => {
    it('returns only unassigned tasks', () => {
      const jobs = jobFactory.createMany({ count: 10 });
      const unassignedTasks = jobFactory.extractUnassignedTasks(jobs);

      for (const task of unassignedTasks) {
        expect(task.status).not.toBe('Assigned');
        expect(task.status).not.toBe('Completed');
      }
    });
  });

  describe('extractAssignedTasks', () => {
    it('returns only assigned tasks', () => {
      const jobs = jobFactory.createMany({ count: 10 });
      const assignedTasks = jobFactory.extractAssignedTasks(jobs);

      for (const task of assignedTasks) {
        expect(task.status).toBe('Assigned');
      }
    });
  });
});
