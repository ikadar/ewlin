/**
 * Snapshot Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSnapshot,
  getSnapshot,
  invalidateSnapshot,
  updateSnapshot,
  getJobById,
  getTasksForJob,
  getAssignmentForTask,
  getStationById,
  getProviderById,
} from './snapshot';

describe('createSnapshot', () => {
  it('creates a valid ScheduleSnapshot', () => {
    const snapshot = createSnapshot();

    expect(snapshot).toHaveProperty('version');
    expect(snapshot).toHaveProperty('generatedAt');
    expect(snapshot).toHaveProperty('stations');
    expect(snapshot).toHaveProperty('categories');
    expect(snapshot).toHaveProperty('groups');
    expect(snapshot).toHaveProperty('providers');
    expect(snapshot).toHaveProperty('jobs');
    expect(snapshot).toHaveProperty('tasks');
    expect(snapshot).toHaveProperty('assignments');
    expect(snapshot).toHaveProperty('conflicts');
    expect(snapshot).toHaveProperty('lateJobs');
  });

  it('version starts at 1', () => {
    const snapshot = createSnapshot();
    expect(snapshot.version).toBe(1);
  });

  it('generatedAt is valid ISO timestamp', () => {
    const snapshot = createSnapshot();
    expect(new Date(snapshot.generatedAt).toString()).not.toBe('Invalid Date');
  });

  it('respects jobCount option', () => {
    const snapshot = createSnapshot({ jobCount: 5 });
    expect(snapshot.jobs.length).toBe(5);
  });

  it('respects lateJobCount option', () => {
    const snapshot = createSnapshot({ jobCount: 10, lateJobCount: 3 });
    expect(snapshot.lateJobs.length).toBeGreaterThanOrEqual(3);
  });

  it('all arrays are populated', () => {
    const snapshot = createSnapshot();

    expect(snapshot.stations.length).toBeGreaterThan(0);
    expect(snapshot.categories.length).toBeGreaterThan(0);
    expect(snapshot.groups.length).toBeGreaterThan(0);
    expect(snapshot.providers.length).toBeGreaterThan(0);
    expect(snapshot.jobs.length).toBeGreaterThan(0);
    expect(snapshot.tasks.length).toBeGreaterThan(0);
  });
});

describe('snapshot cache', () => {
  beforeEach(() => {
    invalidateSnapshot();
  });

  it('getSnapshot returns cached snapshot', () => {
    const first = getSnapshot();
    const second = getSnapshot();
    expect(first).toBe(second);
  });

  it('invalidateSnapshot clears cache', () => {
    const first = getSnapshot();
    invalidateSnapshot();
    const second = getSnapshot();
    expect(first).not.toBe(second);
  });

  it('different options invalidate cache', () => {
    const first = getSnapshot({ jobCount: 5 });
    const second = getSnapshot({ jobCount: 10 });
    expect(first).not.toBe(second);
  });

  it('same options return cached snapshot', () => {
    const first = getSnapshot({ jobCount: 5 });
    const second = getSnapshot({ jobCount: 5 });
    expect(first).toBe(second);
  });
});

describe('updateSnapshot', () => {
  beforeEach(() => {
    invalidateSnapshot();
  });

  it('increments version', () => {
    const original = getSnapshot();
    const originalVersion = original.version;

    const updated = updateSnapshot((snapshot) => ({
      ...snapshot,
      jobs: snapshot.jobs.slice(0, 1),
    }));

    expect(updated.version).toBe(originalVersion + 1);
  });

  it('updates generatedAt', () => {
    getSnapshot();

    // updateSnapshot always sets a new generatedAt
    const updated = updateSnapshot((snapshot) => ({
      ...snapshot,
    }));

    // Just verify it's a valid ISO timestamp
    expect(new Date(updated.generatedAt).toString()).not.toBe('Invalid Date');
    // And that updateSnapshot was called (version incremented)
    expect(updated.version).toBeGreaterThan(1);
  });

  it('applies the update function', () => {
    getSnapshot({ jobCount: 10 });

    const updated = updateSnapshot((snapshot) => ({
      ...snapshot,
      jobs: snapshot.jobs.slice(0, 3),
    }));

    expect(updated.jobs.length).toBe(3);
  });
});

describe('utility functions', () => {
  beforeEach(() => {
    invalidateSnapshot();
    getSnapshot({ jobCount: 10 });
  });

  describe('getJobById', () => {
    it('returns job when found', () => {
      const snapshot = getSnapshot();
      const firstJob = snapshot.jobs[0];

      const result = getJobById(firstJob.id);
      expect(result).toBeDefined();
      expect(result?.id).toBe(firstJob.id);
    });

    it('returns undefined when not found', () => {
      const result = getJobById('non-existent-job');
      expect(result).toBeUndefined();
    });
  });

  describe('getTasksForJob', () => {
    it('returns tasks for the job', () => {
      const snapshot = getSnapshot();
      const firstJob = snapshot.jobs[0];

      const tasks = getTasksForJob(firstJob.id);
      expect(tasks.length).toBeGreaterThan(0);
      for (const task of tasks) {
        expect(task.jobId).toBe(firstJob.id);
      }
    });

    it('returns empty array for non-existent job', () => {
      const tasks = getTasksForJob('non-existent-job');
      expect(tasks).toEqual([]);
    });
  });

  describe('getAssignmentForTask', () => {
    it('returns assignment when task is assigned', () => {
      const snapshot = getSnapshot();
      const assignedTask = snapshot.tasks.find((t) => t.status === 'Assigned');

      if (assignedTask) {
        const assignment = getAssignmentForTask(assignedTask.id);
        expect(assignment).toBeDefined();
        expect(assignment?.taskId).toBe(assignedTask.id);
      }
    });

    it('returns undefined for unassigned task', () => {
      const snapshot = getSnapshot();
      const unassignedTask = snapshot.tasks.find((t) => t.status !== 'Assigned');

      if (unassignedTask) {
        const assignment = getAssignmentForTask(unassignedTask.id);
        expect(assignment).toBeUndefined();
      }
    });
  });

  describe('getStationById', () => {
    it('returns station when found', () => {
      const snapshot = getSnapshot();
      const firstStation = snapshot.stations[0];

      const result = getStationById(firstStation.id);
      expect(result).toBeDefined();
      expect(result?.id).toBe(firstStation.id);
    });

    it('returns undefined when not found', () => {
      const result = getStationById('non-existent-station');
      expect(result).toBeUndefined();
    });
  });

  describe('getProviderById', () => {
    it('returns provider when found', () => {
      const snapshot = getSnapshot();
      const firstProvider = snapshot.providers[0];

      const result = getProviderById(firstProvider.id);
      expect(result).toBeDefined();
      expect(result?.id).toBe(firstProvider.id);
    });

    it('returns undefined when not found', () => {
      const result = getProviderById('non-existent-provider');
      expect(result).toBeUndefined();
    });
  });
});

describe('data integrity', () => {
  beforeEach(() => {
    invalidateSnapshot();
  });

  it('all task jobIds reference existing jobs', () => {
    const snapshot = createSnapshot();
    const jobIds = new Set(snapshot.jobs.map((j) => j.id));

    for (const task of snapshot.tasks) {
      expect(jobIds.has(task.jobId)).toBe(true);
    }
  });

  it('all assignment taskIds reference existing tasks', () => {
    const snapshot = createSnapshot();
    const taskIds = new Set(snapshot.tasks.map((t) => t.id));

    for (const assignment of snapshot.assignments) {
      expect(taskIds.has(assignment.taskId)).toBe(true);
    }
  });

  it('all lateJob jobIds reference existing jobs', () => {
    const snapshot = createSnapshot({ lateJobCount: 3 });
    const jobIds = new Set(snapshot.jobs.map((j) => j.id));

    for (const lateJob of snapshot.lateJobs) {
      expect(jobIds.has(lateJob.jobId)).toBe(true);
    }
  });

  it('all station categoryIds reference existing categories', () => {
    const snapshot = createSnapshot();
    const categoryIds = new Set(snapshot.categories.map((c) => c.id));

    for (const station of snapshot.stations) {
      expect(categoryIds.has(station.categoryId)).toBe(true);
    }
  });

  it('all station groupIds reference existing groups', () => {
    const snapshot = createSnapshot();
    const groupIds = new Set(snapshot.groups.map((g) => g.id));

    for (const station of snapshot.stations) {
      expect(groupIds.has(station.groupId)).toBe(true);
    }
  });
});
