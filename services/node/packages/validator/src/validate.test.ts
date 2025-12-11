import { describe, it, expect } from 'vitest';
import { validateAssignment, isValidAssignment } from './validate.js';
import type { ScheduleSnapshot, ProposedAssignment } from '@flux/types';

// Test fixture: a minimal valid schedule snapshot
function createTestSnapshot(): ScheduleSnapshot {
  return {
    version: 1,
    generatedAt: '2025-01-15T08:00:00Z',
    stations: [
      {
        id: 'station-1',
        name: 'Komori',
        status: 'Available',
        categoryId: 'cat-1',
        groupId: 'group-1',
        capacity: 1,
        operatingSchedule: {
          monday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
          tuesday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
          wednesday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
          thursday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
          friday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
          saturday: { isOperating: false, slots: [] },
          sunday: { isOperating: false, slots: [] },
        },
        exceptions: [],
      },
      {
        id: 'station-2',
        name: 'Massicot',
        status: 'Available',
        categoryId: 'cat-2',
        groupId: 'group-1',
        capacity: 1,
        operatingSchedule: {
          monday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
          tuesday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
          wednesday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
          thursday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
          friday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
          saturday: { isOperating: false, slots: [] },
          sunday: { isOperating: false, slots: [] },
        },
        exceptions: [],
      },
    ],
    categories: [
      { id: 'cat-1', name: 'Offset', similarityCriteria: [] },
      { id: 'cat-2', name: 'Finishing', similarityCriteria: [] },
    ],
    groups: [{ id: 'group-1', name: 'Main Group', maxConcurrent: 2, isOutsourcedProviderGroup: false }],
    providers: [],
    jobs: [
      {
        id: 'job-1',
        reference: 'JOB-001',
        client: 'Test Client',
        description: 'Test Job',
        status: 'Planned',
        workshopExitDate: '2025-01-20',
        fullyScheduled: false,
        color: '#3B82F6',
        paperPurchaseStatus: 'InStock',
        proofApproval: { sentAt: 'NoProofRequired', approvedAt: null },
        platesStatus: 'Done',
        requiredJobIds: [],
        comments: [],
        taskIds: ['task-1', 'task-2'],
        createdAt: '2025-01-10T00:00:00Z',
        updatedAt: '2025-01-10T00:00:00Z',
      },
    ],
    tasks: [
      {
        id: 'task-1',
        jobId: 'job-1',
        type: 'Internal',
        sequenceOrder: 0,
        status: 'Ready',
        stationId: 'station-1',
        duration: { setupMinutes: 15, runMinutes: 45 },
        createdAt: '2025-01-10T00:00:00Z',
        updatedAt: '2025-01-10T00:00:00Z',
      },
      {
        id: 'task-2',
        jobId: 'job-1',
        type: 'Internal',
        sequenceOrder: 1,
        status: 'Ready',
        stationId: 'station-2',
        duration: { setupMinutes: 10, runMinutes: 20 },
        createdAt: '2025-01-10T00:00:00Z',
        updatedAt: '2025-01-10T00:00:00Z',
      },
    ],
    assignments: [],
    conflicts: [],
    lateJobs: [],
  };
}

describe('validateAssignment', () => {
  it('should return valid for a valid assignment', () => {
    const snapshot = createTestSnapshot();
    const proposed: ProposedAssignment = {
      taskId: 'task-1',
      targetId: 'station-1',
      isOutsourced: false,
      scheduledStart: '2025-01-15T09:00:00Z', // Wednesday, within hours
    };

    const result = validateAssignment(proposed, snapshot);
    expect(result.valid).toBe(true);
    expect(result.conflicts).toHaveLength(0);
  });

  it('should detect station conflict', () => {
    const snapshot = createTestSnapshot();
    // Add an existing assignment
    snapshot.assignments.push({
      id: 'assign-1',
      taskId: 'task-1',
      targetId: 'station-1',
      isOutsourced: false,
      scheduledStart: '2025-01-15T09:00:00Z',
      scheduledEnd: '2025-01-15T10:00:00Z',
      createdAt: '2025-01-10T00:00:00Z',
      updatedAt: '2025-01-10T00:00:00Z',
    });

    // Add another task to the job
    snapshot.tasks.push({
      id: 'task-3',
      jobId: 'job-1',
      type: 'Internal',
      sequenceOrder: 2,
      status: 'Ready',
      stationId: 'station-1',
      duration: { setupMinutes: 10, runMinutes: 20 },
      createdAt: '2025-01-10T00:00:00Z',
      updatedAt: '2025-01-10T00:00:00Z',
    });

    const proposed: ProposedAssignment = {
      taskId: 'task-3',
      targetId: 'station-1',
      isOutsourced: false,
      scheduledStart: '2025-01-15T09:30:00Z', // Overlaps with existing
    };

    const result = validateAssignment(proposed, snapshot);
    expect(result.valid).toBe(false);
    expect(result.conflicts.some((c) => c.type === 'StationConflict')).toBe(true);
  });

  it('should detect precedence conflict when predecessor not scheduled', () => {
    const snapshot = createTestSnapshot();

    // Try to schedule task-2 without task-1 being scheduled first
    const proposed: ProposedAssignment = {
      taskId: 'task-2',
      targetId: 'station-2',
      isOutsourced: false,
      scheduledStart: '2025-01-15T09:00:00Z',
    };

    const result = validateAssignment(proposed, snapshot);
    expect(result.valid).toBe(false);
    expect(result.conflicts.some((c) => c.type === 'PrecedenceConflict')).toBe(true);
  });

  it('should detect precedence conflict when starting before predecessor ends', () => {
    const snapshot = createTestSnapshot();

    // Schedule task-1 first
    snapshot.assignments.push({
      id: 'assign-1',
      taskId: 'task-1',
      targetId: 'station-1',
      isOutsourced: false,
      scheduledStart: '2025-01-15T09:00:00Z',
      scheduledEnd: '2025-01-15T10:00:00Z',
      createdAt: '2025-01-10T00:00:00Z',
      updatedAt: '2025-01-10T00:00:00Z',
    });

    // Try to schedule task-2 before task-1 ends
    const proposed: ProposedAssignment = {
      taskId: 'task-2',
      targetId: 'station-2',
      isOutsourced: false,
      scheduledStart: '2025-01-15T09:30:00Z', // Before 10:00
    };

    const result = validateAssignment(proposed, snapshot);
    expect(result.valid).toBe(false);
    expect(result.conflicts.some((c) => c.type === 'PrecedenceConflict')).toBe(true);
    expect(result.suggestedStart).toBe('2025-01-15T10:00:00Z');
  });

  it('should allow precedence bypass with flag', () => {
    const snapshot = createTestSnapshot();

    // Schedule task-1 first
    snapshot.assignments.push({
      id: 'assign-1',
      taskId: 'task-1',
      targetId: 'station-1',
      isOutsourced: false,
      scheduledStart: '2025-01-15T09:00:00Z',
      scheduledEnd: '2025-01-15T10:00:00Z',
      createdAt: '2025-01-10T00:00:00Z',
      updatedAt: '2025-01-10T00:00:00Z',
    });

    // Try to schedule task-2 before task-1 ends, with bypass
    const proposed: ProposedAssignment = {
      taskId: 'task-2',
      targetId: 'station-2',
      isOutsourced: false,
      scheduledStart: '2025-01-15T09:30:00Z',
      bypassPrecedence: true,
    };

    const result = validateAssignment(proposed, snapshot);
    // Should not have precedence conflict (bypassed)
    expect(result.conflicts.every((c) => c.type !== 'PrecedenceConflict')).toBe(true);
  });

  it('should detect deadline conflict', () => {
    const snapshot = createTestSnapshot();
    // Change deadline to be earlier
    const job = snapshot.jobs[0];
    if (job) {
      job.workshopExitDate = '2025-01-15'; // Same day
    }

    // Schedule at a time that would end after deadline
    const proposed: ProposedAssignment = {
      taskId: 'task-1',
      targetId: 'station-1',
      isOutsourced: false,
      scheduledStart: '2025-01-15T23:00:00Z', // Would end at 00:00 next day
    };

    const result = validateAssignment(proposed, snapshot);
    expect(result.valid).toBe(false);
    expect(result.conflicts.some((c) => c.type === 'DeadlineConflict')).toBe(true);
  });

  it('should detect approval gate conflict when BAT not approved', () => {
    const snapshot = createTestSnapshot();
    // Change job to require BAT approval
    const job = snapshot.jobs[0];
    if (job) {
      job.proofApproval = { sentAt: '2025-01-10', approvedAt: null };
    }

    const proposed: ProposedAssignment = {
      taskId: 'task-1',
      targetId: 'station-1',
      isOutsourced: false,
      scheduledStart: '2025-01-15T09:00:00Z',
    };

    const result = validateAssignment(proposed, snapshot);
    expect(result.valid).toBe(false);
    expect(result.conflicts.some((c) => c.type === 'ApprovalGateConflict')).toBe(true);
  });

  it('should detect group capacity conflict', () => {
    const snapshot = createTestSnapshot();
    // Set max concurrent to 1
    const group = snapshot.groups[0];
    if (group) {
      group.maxConcurrent = 1;
    }

    // Add existing assignment on station-1
    snapshot.assignments.push({
      id: 'assign-1',
      taskId: 'task-1',
      targetId: 'station-1',
      isOutsourced: false,
      scheduledStart: '2025-01-15T09:00:00Z',
      scheduledEnd: '2025-01-15T10:00:00Z',
      createdAt: '2025-01-10T00:00:00Z',
      updatedAt: '2025-01-10T00:00:00Z',
    });

    // Add another task
    snapshot.tasks.push({
      id: 'task-3',
      jobId: 'job-1',
      type: 'Internal',
      sequenceOrder: 2,
      status: 'Ready',
      stationId: 'station-2',
      duration: { setupMinutes: 10, runMinutes: 20 },
      createdAt: '2025-01-10T00:00:00Z',
      updatedAt: '2025-01-10T00:00:00Z',
    });

    // Update job proofs to be satisfied
    const job = snapshot.jobs[0];
    if (job) {
      job.proofApproval = { sentAt: 'NoProofRequired', approvedAt: null };
    }

    // Try to schedule on station-2 at overlapping time (same group)
    const proposed: ProposedAssignment = {
      taskId: 'task-3',
      targetId: 'station-2',
      isOutsourced: false,
      scheduledStart: '2025-01-15T09:30:00Z', // Overlaps with task-1
    };

    const result = validateAssignment(proposed, snapshot);
    expect(result.valid).toBe(false);
    expect(result.conflicts.some((c) => c.type === 'GroupCapacityConflict')).toBe(true);
  });
});

describe('isValidAssignment', () => {
  it('should return true for valid assignment', () => {
    const snapshot = createTestSnapshot();
    const proposed: ProposedAssignment = {
      taskId: 'task-1',
      targetId: 'station-1',
      isOutsourced: false,
      scheduledStart: '2025-01-15T09:00:00Z',
    };

    expect(isValidAssignment(proposed, snapshot)).toBe(true);
  });

  it('should return false for invalid assignment', () => {
    const snapshot = createTestSnapshot();
    // Change job to require BAT approval
    const job = snapshot.jobs[0];
    if (job) {
      job.proofApproval = { sentAt: null, approvedAt: null };
    }

    const proposed: ProposedAssignment = {
      taskId: 'task-1',
      targetId: 'station-1',
      isOutsourced: false,
      scheduledStart: '2025-01-15T09:00:00Z',
    };

    expect(isValidAssignment(proposed, snapshot)).toBe(false);
  });
});
