/**
 * Group Capacity Utilities Tests
 * Tests for REQ-18: Group capacity calculation and visualization
 */

import { describe, it, expect } from 'vitest';
import type { TaskAssignment, Station, StationGroup } from '@flux/types';
import {
  calculateGroupUsageAtTime,
  calculateMaxGroupUsage,
  getGroupCapacityInfo,
  buildGroupCapacityMap,
  findExceededGroups,
} from './groupCapacity';

// Test fixtures
const createStation = (id: string, groupId: string): Station => ({
  id,
  name: `Station ${id}`,
  status: 'Available',
  categoryId: 'cat-1',
  groupId,
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
});

const createGroup = (id: string, maxConcurrent: number | null): StationGroup => ({
  id,
  name: `Group ${id}`,
  maxConcurrent,
  isOutsourcedProviderGroup: false,
});

const createAssignment = (
  id: string,
  targetId: string,
  scheduledStart: string,
  scheduledEnd: string,
  isOutsourced = false
): TaskAssignment => ({
  id,
  taskId: `task-${id}`,
  targetId,
  isOutsourced,
  scheduledStart,
  scheduledEnd,
});

describe('calculateGroupUsageAtTime', () => {
  it('returns empty map when no assignments', () => {
    const stations = [createStation('sta-1', 'grp-1')];
    const assignments: TaskAssignment[] = [];
    const time = new Date('2025-01-01T10:00:00Z');

    const result = calculateGroupUsageAtTime(assignments, stations, time);

    expect(result.size).toBe(0);
  });

  it('counts active assignments in a group at a given time', () => {
    const stations = [
      createStation('sta-1', 'grp-1'),
      createStation('sta-2', 'grp-1'),
    ];
    const assignments = [
      createAssignment('a1', 'sta-1', '2025-01-01T08:00:00Z', '2025-01-01T12:00:00Z'),
      createAssignment('a2', 'sta-2', '2025-01-01T10:00:00Z', '2025-01-01T14:00:00Z'),
    ];
    const time = new Date('2025-01-01T11:00:00Z');

    const result = calculateGroupUsageAtTime(assignments, stations, time);

    expect(result.get('grp-1')).toBe(2);
  });

  it('excludes assignments that have not started', () => {
    const stations = [createStation('sta-1', 'grp-1')];
    const assignments = [
      createAssignment('a1', 'sta-1', '2025-01-01T12:00:00Z', '2025-01-01T14:00:00Z'),
    ];
    const time = new Date('2025-01-01T10:00:00Z');

    const result = calculateGroupUsageAtTime(assignments, stations, time);

    expect(result.get('grp-1')).toBeUndefined();
  });

  it('excludes assignments that have ended', () => {
    const stations = [createStation('sta-1', 'grp-1')];
    const assignments = [
      createAssignment('a1', 'sta-1', '2025-01-01T08:00:00Z', '2025-01-01T10:00:00Z'),
    ];
    const time = new Date('2025-01-01T11:00:00Z');

    const result = calculateGroupUsageAtTime(assignments, stations, time);

    expect(result.get('grp-1')).toBeUndefined();
  });

  it('excludes outsourced assignments', () => {
    const stations = [createStation('sta-1', 'grp-1')];
    const assignments = [
      createAssignment('a1', 'sta-1', '2025-01-01T08:00:00Z', '2025-01-01T12:00:00Z', true),
    ];
    const time = new Date('2025-01-01T10:00:00Z');

    const result = calculateGroupUsageAtTime(assignments, stations, time);

    expect(result.get('grp-1')).toBeUndefined();
  });

  it('handles multiple groups correctly', () => {
    const stations = [
      createStation('sta-1', 'grp-1'),
      createStation('sta-2', 'grp-2'),
    ];
    const assignments = [
      createAssignment('a1', 'sta-1', '2025-01-01T08:00:00Z', '2025-01-01T12:00:00Z'),
      createAssignment('a2', 'sta-2', '2025-01-01T08:00:00Z', '2025-01-01T12:00:00Z'),
    ];
    const time = new Date('2025-01-01T10:00:00Z');

    const result = calculateGroupUsageAtTime(assignments, stations, time);

    expect(result.get('grp-1')).toBe(1);
    expect(result.get('grp-2')).toBe(1);
  });
});

describe('calculateMaxGroupUsage', () => {
  it('finds maximum concurrent usage across all time points', () => {
    const stations = [
      createStation('sta-1', 'grp-1'),
      createStation('sta-2', 'grp-1'),
    ];
    const assignments = [
      // Both overlap at 10:00-11:00
      createAssignment('a1', 'sta-1', '2025-01-01T08:00:00Z', '2025-01-01T11:00:00Z'),
      createAssignment('a2', 'sta-2', '2025-01-01T10:00:00Z', '2025-01-01T14:00:00Z'),
    ];

    const result = calculateMaxGroupUsage(assignments, stations);

    expect(result.get('grp-1')).toBe(2);
  });

  it('returns empty map when no assignments', () => {
    const stations = [createStation('sta-1', 'grp-1')];
    const assignments: TaskAssignment[] = [];

    const result = calculateMaxGroupUsage(assignments, stations);

    expect(result.size).toBe(0);
  });
});

describe('getGroupCapacityInfo', () => {
  it('returns undefined for unlimited capacity groups', () => {
    const station = createStation('sta-1', 'grp-1');
    const groups = [createGroup('grp-1', null)];
    const assignments: TaskAssignment[] = [];
    const stations = [station];

    const result = getGroupCapacityInfo(station, groups, assignments, stations);

    expect(result).toBeUndefined();
  });

  it('returns capacity info for limited capacity groups', () => {
    const station = createStation('sta-1', 'grp-1');
    const groups = [createGroup('grp-1', 3)];
    const assignments = [
      createAssignment('a1', 'sta-1', '2025-01-01T08:00:00Z', '2025-01-01T12:00:00Z'),
    ];
    const stations = [station];
    const time = new Date('2025-01-01T10:00:00Z');

    const result = getGroupCapacityInfo(station, groups, assignments, stations, time);

    expect(result).toEqual({
      groupId: 'grp-1',
      groupName: 'Group grp-1',
      maxConcurrent: 3,
      currentUsage: 1,
    });
  });

  it('returns undefined when group not found', () => {
    const station = createStation('sta-1', 'grp-nonexistent');
    const groups = [createGroup('grp-1', 3)];
    const assignments: TaskAssignment[] = [];
    const stations = [station];

    const result = getGroupCapacityInfo(station, groups, assignments, stations);

    expect(result).toBeUndefined();
  });
});

describe('buildGroupCapacityMap', () => {
  it('builds capacity map for all stations with limited groups', () => {
    const stations = [
      createStation('sta-1', 'grp-1'),
      createStation('sta-2', 'grp-1'),
      createStation('sta-3', 'grp-2'),
    ];
    const groups = [
      createGroup('grp-1', 2),
      createGroup('grp-2', null), // unlimited
    ];
    const assignments = [
      createAssignment('a1', 'sta-1', '2025-01-01T08:00:00Z', '2025-01-01T12:00:00Z'),
    ];
    const time = new Date('2025-01-01T10:00:00Z');

    const result = buildGroupCapacityMap(stations, groups, assignments, time);

    // sta-1 and sta-2 are in grp-1 (limited)
    expect(result.get('sta-1')).toBeDefined();
    expect(result.get('sta-2')).toBeDefined();
    // sta-3 is in grp-2 (unlimited) - should not be included
    expect(result.get('sta-3')).toBeUndefined();
  });
});

describe('findExceededGroups', () => {
  it('finds groups where capacity is exceeded', () => {
    const stations = [
      createStation('sta-1', 'grp-1'),
      createStation('sta-2', 'grp-1'),
      createStation('sta-3', 'grp-1'),
    ];
    const groups = [createGroup('grp-1', 2)]; // max 2
    const assignments = [
      // 3 overlapping assignments - exceeds capacity
      createAssignment('a1', 'sta-1', '2025-01-01T08:00:00Z', '2025-01-01T12:00:00Z'),
      createAssignment('a2', 'sta-2', '2025-01-01T08:00:00Z', '2025-01-01T12:00:00Z'),
      createAssignment('a3', 'sta-3', '2025-01-01T08:00:00Z', '2025-01-01T12:00:00Z'),
    ];

    const result = findExceededGroups(groups, assignments, stations);

    expect(result).toContain('grp-1');
  });

  it('returns empty array when no capacity exceeded', () => {
    const stations = [
      createStation('sta-1', 'grp-1'),
      createStation('sta-2', 'grp-1'),
    ];
    const groups = [createGroup('grp-1', 2)];
    const assignments = [
      // 2 overlapping assignments - at capacity but not exceeded
      createAssignment('a1', 'sta-1', '2025-01-01T08:00:00Z', '2025-01-01T12:00:00Z'),
      createAssignment('a2', 'sta-2', '2025-01-01T08:00:00Z', '2025-01-01T12:00:00Z'),
    ];

    const result = findExceededGroups(groups, assignments, stations);

    expect(result).toHaveLength(0);
  });

  it('ignores unlimited capacity groups', () => {
    const stations = [
      createStation('sta-1', 'grp-1'),
      createStation('sta-2', 'grp-1'),
      createStation('sta-3', 'grp-1'),
    ];
    const groups = [createGroup('grp-1', null)]; // unlimited
    const assignments = [
      // 3 overlapping assignments but unlimited capacity
      createAssignment('a1', 'sta-1', '2025-01-01T08:00:00Z', '2025-01-01T12:00:00Z'),
      createAssignment('a2', 'sta-2', '2025-01-01T08:00:00Z', '2025-01-01T12:00:00Z'),
      createAssignment('a3', 'sta-3', '2025-01-01T08:00:00Z', '2025-01-01T12:00:00Z'),
    ];

    const result = findExceededGroups(groups, assignments, stations);

    expect(result).toHaveLength(0);
  });
});
