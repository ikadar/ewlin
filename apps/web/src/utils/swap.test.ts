import { describe, it, expect } from 'vitest';
import { applySwap, findAdjacentAssignment } from './swap';
import type { TaskAssignment } from '@flux/types';

// Helper to create test assignments
function createAssignment(
  id: string,
  stationId: string,
  startHour: number,
  durationHours: number
): TaskAssignment {
  const baseDate = new Date('2025-12-16T00:00:00Z');
  const start = new Date(baseDate);
  start.setHours(startHour);
  const end = new Date(start);
  end.setHours(startHour + durationHours);

  return {
    id,
    taskId: `task-${id}`,
    targetId: stationId,
    isOutsourced: false,
    scheduledStart: start.toISOString(),
    scheduledEnd: end.toISOString(),
    isCompleted: false,
    completedAt: null,
    createdAt: '2025-12-16T00:00:00Z',
    updatedAt: '2025-12-16T00:00:00Z',
  };
}

describe('findAdjacentAssignment', () => {
  const stationA = 'station-a';
  const stationB = 'station-b';

  it('returns the assignment above when direction is up', () => {
    const assignments: TaskAssignment[] = [
      createAssignment('a1', stationA, 8, 1), // 08:00-09:00
      createAssignment('a2', stationA, 9, 1), // 09:00-10:00
      createAssignment('a3', stationA, 10, 1), // 10:00-11:00
    ];

    const adjacent = findAdjacentAssignment(assignments, 'a2', 'up');
    expect(adjacent).not.toBeNull();
    expect(adjacent!.id).toBe('a1');
  });

  it('returns the assignment below when direction is down', () => {
    const assignments: TaskAssignment[] = [
      createAssignment('a1', stationA, 8, 1),
      createAssignment('a2', stationA, 9, 1),
      createAssignment('a3', stationA, 10, 1),
    ];

    const adjacent = findAdjacentAssignment(assignments, 'a2', 'down');
    expect(adjacent).not.toBeNull();
    expect(adjacent!.id).toBe('a3');
  });

  it('returns null when there is no tile above (first tile)', () => {
    const assignments: TaskAssignment[] = [
      createAssignment('a1', stationA, 8, 1),
      createAssignment('a2', stationA, 9, 1),
    ];

    const adjacent = findAdjacentAssignment(assignments, 'a1', 'up');
    expect(adjacent).toBeNull();
  });

  it('returns null when there is no tile below (last tile)', () => {
    const assignments: TaskAssignment[] = [
      createAssignment('a1', stationA, 8, 1),
      createAssignment('a2', stationA, 9, 1),
    ];

    const adjacent = findAdjacentAssignment(assignments, 'a2', 'down');
    expect(adjacent).toBeNull();
  });

  it('only considers assignments on the same station', () => {
    const assignments: TaskAssignment[] = [
      createAssignment('a1', stationA, 8, 1),
      createAssignment('b1', stationB, 8, 1), // Different station
      createAssignment('a2', stationA, 9, 1),
    ];

    const adjacent = findAdjacentAssignment(assignments, 'a2', 'up');
    expect(adjacent).not.toBeNull();
    expect(adjacent!.id).toBe('a1');
  });

  it('returns null for non-existent assignment', () => {
    const assignments: TaskAssignment[] = [
      createAssignment('a1', stationA, 8, 1),
    ];

    const adjacent = findAdjacentAssignment(assignments, 'non-existent', 'up');
    expect(adjacent).toBeNull();
  });

  it('ignores outsourced assignments', () => {
    const assignments: TaskAssignment[] = [
      createAssignment('a1', stationA, 8, 1),
      { ...createAssignment('a2', stationA, 9, 1), isOutsourced: true },
      createAssignment('a3', stationA, 10, 1),
    ];

    // a3's adjacent up should be a1, skipping the outsourced a2
    const adjacent = findAdjacentAssignment(assignments, 'a3', 'up');
    expect(adjacent).not.toBeNull();
    expect(adjacent!.id).toBe('a1');
  });
});

describe('applySwap', () => {
  const stationA = 'station-a';

  it('swaps two adjacent assignments when swap up', () => {
    const assignments: TaskAssignment[] = [
      createAssignment('a1', stationA, 8, 1), // 08:00-09:00 (1 hour)
      createAssignment('a2', stationA, 9, 2), // 09:00-11:00 (2 hours)
    ];

    const result = applySwap(assignments, 'a2', 'up');

    expect(result.swapped).toBe(true);
    expect(result.swappedWithId).toBe('a1');

    // a2 should now start at 08:00 (moved up)
    const newA2 = result.assignments.find((a) => a.id === 'a2')!;
    expect(new Date(newA2.scheduledStart).getHours()).toBe(8);
    expect(new Date(newA2.scheduledEnd).getHours()).toBe(10); // 2 hours duration preserved

    // a1 should now start at 10:00 (moved down, after a2)
    const newA1 = result.assignments.find((a) => a.id === 'a1')!;
    expect(new Date(newA1.scheduledStart).getHours()).toBe(10);
    expect(new Date(newA1.scheduledEnd).getHours()).toBe(11); // 1 hour duration preserved
  });

  it('swaps two adjacent assignments when swap down', () => {
    const assignments: TaskAssignment[] = [
      createAssignment('a1', stationA, 8, 2), // 08:00-10:00 (2 hours)
      createAssignment('a2', stationA, 10, 1), // 10:00-11:00 (1 hour)
    ];

    const result = applySwap(assignments, 'a1', 'down');

    expect(result.swapped).toBe(true);
    expect(result.swappedWithId).toBe('a2');

    // a2 should now start at 08:00 (moved up)
    const newA2 = result.assignments.find((a) => a.id === 'a2')!;
    expect(new Date(newA2.scheduledStart).getHours()).toBe(8);
    expect(new Date(newA2.scheduledEnd).getHours()).toBe(9); // 1 hour duration preserved

    // a1 should now start at 09:00 (moved down, after a2)
    const newA1 = result.assignments.find((a) => a.id === 'a1')!;
    expect(new Date(newA1.scheduledStart).getHours()).toBe(9);
    expect(new Date(newA1.scheduledEnd).getHours()).toBe(11); // 2 hours duration preserved
  });

  it('returns unchanged when no adjacent tile exists (swap up on first)', () => {
    const assignments: TaskAssignment[] = [
      createAssignment('a1', stationA, 8, 1),
      createAssignment('a2', stationA, 9, 1),
    ];

    const result = applySwap(assignments, 'a1', 'up');

    expect(result.swapped).toBe(false);
    expect(result.swappedWithId).toBeNull();
    expect(result.assignments).toBe(assignments); // Same reference
  });

  it('returns unchanged when no adjacent tile exists (swap down on last)', () => {
    const assignments: TaskAssignment[] = [
      createAssignment('a1', stationA, 8, 1),
      createAssignment('a2', stationA, 9, 1),
    ];

    const result = applySwap(assignments, 'a2', 'down');

    expect(result.swapped).toBe(false);
    expect(result.swappedWithId).toBeNull();
    expect(result.assignments).toBe(assignments);
  });

  it('preserves other assignments unchanged', () => {
    const stationB = 'station-b';
    const assignments: TaskAssignment[] = [
      createAssignment('a1', stationA, 8, 1),
      createAssignment('a2', stationA, 9, 1),
      createAssignment('b1', stationB, 8, 1), // Different station
    ];

    const result = applySwap(assignments, 'a2', 'up');

    expect(result.swapped).toBe(true);

    // b1 should be unchanged
    const b1Before = assignments.find((a) => a.id === 'b1')!;
    const b1After = result.assignments.find((a) => a.id === 'b1')!;
    expect(b1After.scheduledStart).toBe(b1Before.scheduledStart);
    expect(b1After.scheduledEnd).toBe(b1Before.scheduledEnd);
  });

  it('updates updatedAt timestamp on swapped assignments', () => {
    const assignments: TaskAssignment[] = [
      createAssignment('a1', stationA, 8, 1),
      createAssignment('a2', stationA, 9, 1),
    ];

    const beforeSwap = new Date().toISOString();
    const result = applySwap(assignments, 'a2', 'up');

    const newA1 = result.assignments.find((a) => a.id === 'a1')!;
    const newA2 = result.assignments.find((a) => a.id === 'a2')!;

    expect(new Date(newA1.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(beforeSwap).getTime()
    );
    expect(new Date(newA2.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(beforeSwap).getTime()
    );
  });

  it('handles three tiles correctly (swap middle up)', () => {
    const assignments: TaskAssignment[] = [
      createAssignment('a1', stationA, 8, 1), // 08:00-09:00
      createAssignment('a2', stationA, 9, 1), // 09:00-10:00
      createAssignment('a3', stationA, 10, 1), // 10:00-11:00
    ];

    const result = applySwap(assignments, 'a2', 'up');

    expect(result.swapped).toBe(true);

    // a2 should now be first (08:00-09:00)
    const newA2 = result.assignments.find((a) => a.id === 'a2')!;
    expect(new Date(newA2.scheduledStart).getHours()).toBe(8);

    // a1 should now be second (09:00-10:00)
    const newA1 = result.assignments.find((a) => a.id === 'a1')!;
    expect(new Date(newA1.scheduledStart).getHours()).toBe(9);

    // a3 should be unchanged (10:00-11:00)
    const newA3 = result.assignments.find((a) => a.id === 'a3')!;
    expect(new Date(newA3.scheduledStart).getHours()).toBe(10);
  });

  it('handles three tiles correctly (swap middle down)', () => {
    const assignments: TaskAssignment[] = [
      createAssignment('a1', stationA, 8, 1), // 08:00-09:00
      createAssignment('a2', stationA, 9, 1), // 09:00-10:00
      createAssignment('a3', stationA, 10, 1), // 10:00-11:00
    ];

    const result = applySwap(assignments, 'a2', 'down');

    expect(result.swapped).toBe(true);

    // a1 should be unchanged (08:00-09:00)
    const newA1 = result.assignments.find((a) => a.id === 'a1')!;
    expect(new Date(newA1.scheduledStart).getHours()).toBe(8);

    // a3 should now be second (09:00-10:00)
    const newA3 = result.assignments.find((a) => a.id === 'a3')!;
    expect(new Date(newA3.scheduledStart).getHours()).toBe(9);

    // a2 should now be third (10:00-11:00)
    const newA2 = result.assignments.find((a) => a.id === 'a2')!;
    expect(new Date(newA2.scheduledStart).getHours()).toBe(10);
  });

  it('preserves isCompleted status after swap', () => {
    const assignments: TaskAssignment[] = [
      { ...createAssignment('a1', stationA, 8, 1), isCompleted: true, completedAt: '2025-12-16T10:00:00Z' },
      createAssignment('a2', stationA, 9, 1),
    ];

    const result = applySwap(assignments, 'a2', 'up');

    const newA1 = result.assignments.find((a) => a.id === 'a1')!;
    expect(newA1.isCompleted).toBe(true);
    expect(newA1.completedAt).toBe('2025-12-16T10:00:00Z');
  });
});
