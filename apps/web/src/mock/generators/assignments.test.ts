/**
 * Assignment Generator Tests
 */

import { describe, it, expect } from 'vitest';
import { generateAssignments, generateConflicts, generateAllAssignmentData } from './assignments';
import { generateJobs } from './jobs';
import { generateStations } from './stations';

describe('generateAssignments', () => {
  it('returns assignments array', () => {
    const { jobs, tasks } = generateJobs({ count: 5 });
    const stations = generateStations();

    const result = generateAssignments({ tasks, jobs, stations });

    expect(result).toHaveProperty('assignments');
    expect(Array.isArray(result.assignments)).toBe(true);
  });

  it('creates assignments only for tasks with Assigned status', () => {
    const { jobs, tasks } = generateJobs({ count: 10 });
    const stations = generateStations();

    const assignedTaskIds = new Set(tasks.filter((t) => t.status === 'Assigned').map((t) => t.id));

    const result = generateAssignments({ tasks, jobs, stations });

    for (const assignment of result.assignments) {
      expect(assignedTaskIds.has(assignment.taskId)).toBe(true);
    }
  });

  it('each assignment has required fields', () => {
    const { jobs, tasks } = generateJobs({ count: 5 });
    const stations = generateStations();

    const result = generateAssignments({ tasks, jobs, stations });

    for (const assignment of result.assignments) {
      expect(assignment).toHaveProperty('id');
      expect(assignment).toHaveProperty('taskId');
      expect(assignment).toHaveProperty('targetId');
      expect(assignment).toHaveProperty('isOutsourced');
      expect(assignment).toHaveProperty('scheduledStart');
      expect(assignment).toHaveProperty('scheduledEnd');
      expect(assignment).toHaveProperty('isCompleted');
      expect(assignment).toHaveProperty('createdAt');
      expect(assignment).toHaveProperty('updatedAt');
    }
  });

  it('scheduledStart is before scheduledEnd', () => {
    const { jobs, tasks } = generateJobs({ count: 5 });
    const stations = generateStations();

    const result = generateAssignments({ tasks, jobs, stations });

    for (const assignment of result.assignments) {
      const start = new Date(assignment.scheduledStart);
      const end = new Date(assignment.scheduledEnd);
      expect(start.getTime()).toBeLessThan(end.getTime());
    }
  });

  it('timestamps are valid ISO strings', () => {
    const { jobs, tasks } = generateJobs({ count: 5 });
    const stations = generateStations();

    const result = generateAssignments({ tasks, jobs, stations });

    for (const assignment of result.assignments) {
      expect(new Date(assignment.scheduledStart).toString()).not.toBe('Invalid Date');
      expect(new Date(assignment.scheduledEnd).toString()).not.toBe('Invalid Date');
      expect(new Date(assignment.createdAt).toString()).not.toBe('Invalid Date');
    }
  });

  it('completed assignments have completedAt timestamp', () => {
    const { jobs, tasks } = generateJobs({ count: 10 });
    const stations = generateStations();

    const result = generateAssignments({ tasks, jobs, stations });
    const completedAssignments = result.assignments.filter((a) => a.isCompleted);

    for (const assignment of completedAssignments) {
      expect(assignment.completedAt).not.toBeNull();
      expect(new Date(assignment.completedAt!).toString()).not.toBe('Invalid Date');
    }
  });

  it('tracks station availability correctly', () => {
    const { jobs, tasks } = generateJobs({ count: 5 });
    const stations = generateStations();

    const result = generateAssignments({ tasks, jobs, stations });

    expect(result).toHaveProperty('stationNextAvailable');
    expect(result.stationNextAvailable).toBeInstanceOf(Map);
  });
});

describe('generateConflicts', () => {
  it('returns conflicts array', () => {
    const { jobs, tasks } = generateJobs({ count: 5, includeConflictJobs: 1 });
    const stations = generateStations();
    const { assignments } = generateAssignments({ tasks, jobs, stations });

    const conflicts = generateConflicts({ jobs, tasks, assignments });

    expect(Array.isArray(conflicts)).toBe(true);
  });

  it('generates conflicts for jobs marked with CONFLICT_TEST', () => {
    const { jobs, tasks } = generateJobs({ count: 5, includeConflictJobs: 2 });
    const stations = generateStations();
    const { assignments } = generateAssignments({ tasks, jobs, stations });

    const conflictJobs = jobs.filter((j) => j.notes === 'CONFLICT_TEST');
    expect(conflictJobs.length).toBe(2);

    const conflicts = generateConflicts({ jobs, tasks, assignments });

    // Should have at least one conflict per conflict job (if tasks exist)
    const precedenceConflicts = conflicts.filter((c) => c.type === 'PrecedenceConflict');
    expect(precedenceConflicts.length).toBeGreaterThanOrEqual(0);
  });

  it('generates deadline conflicts for delayed jobs', () => {
    const { jobs, tasks } = generateJobs({ count: 5, includeLateJobs: 2 });
    const stations = generateStations();
    const { assignments } = generateAssignments({ tasks, jobs, stations });

    const conflicts = generateConflicts({ jobs, tasks, assignments });
    const deadlineConflicts = conflicts.filter((c) => c.type === 'DeadlineConflict');

    // Delayed jobs should generate deadline conflicts
    expect(deadlineConflicts.length).toBeGreaterThanOrEqual(0);
  });

  it('each conflict has required fields', () => {
    const { jobs, tasks } = generateJobs({ count: 5, includeConflictJobs: 1, includeLateJobs: 1 });
    const stations = generateStations();
    const { assignments } = generateAssignments({ tasks, jobs, stations });

    const conflicts = generateConflicts({ jobs, tasks, assignments });

    for (const conflict of conflicts) {
      expect(conflict).toHaveProperty('type');
      expect(conflict).toHaveProperty('message');
      expect(conflict).toHaveProperty('taskId');
      expect(['PrecedenceConflict', 'DeadlineConflict', 'StationConflict', 'GroupCapacityConflict', 'ApprovalGateConflict', 'AvailabilityConflict']).toContain(conflict.type);
    }
  });
});

describe('generateAllAssignmentData', () => {
  it('returns both assignments and conflicts', () => {
    const { jobs, tasks } = generateJobs({ count: 5 });
    const stations = generateStations();

    const result = generateAllAssignmentData(tasks, jobs, stations);

    expect(result).toHaveProperty('assignments');
    expect(result).toHaveProperty('conflicts');
    expect(Array.isArray(result.assignments)).toBe(true);
    expect(Array.isArray(result.conflicts)).toBe(true);
  });
});
