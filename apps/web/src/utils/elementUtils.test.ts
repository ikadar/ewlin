import { describe, it, expect } from 'vitest';
import type { Element, Task, TaskAssignment } from '@flux/types';
import {
  isFirstTaskOfElement,
  getElementForTask,
  getPrerequisiteElements,
  getLastTaskAssignment,
  getInterElementBound,
} from './elementUtils';

// Helper to create test elements
function createElement(overrides: Partial<Element> = {}): Element {
  return {
    id: 'elem-1',
    jobId: 'job-1',
    suffix: 'ELT',
    prerequisiteElementIds: [],
    taskIds: ['task-1', 'task-2'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create test tasks
function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    jobId: 'job-1',
    stationId: 'station-1',
    sequenceOrder: 1,
    type: 'Internal',
    duration: { setupMinutes: 30, runMinutes: 60 },
    elementId: 'elem-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Task;
}

// Helper to create test assignments
function createAssignment(overrides: Partial<TaskAssignment> = {}): TaskAssignment {
  return {
    id: 'assign-1',
    taskId: 'task-1',
    targetId: 'station-1',
    scheduledStart: '2025-01-20T08:00:00Z',
    scheduledEnd: '2025-01-20T10:00:00Z',
    isOutsourced: false,
    isCompleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('elementUtils', () => {
  describe('isFirstTaskOfElement', () => {
    it('returns true for first task in element', () => {
      const element = createElement({ id: 'elem-1', taskIds: ['task-1', 'task-2'] });
      const task = createTask({ id: 'task-1', elementId: 'elem-1' });

      expect(isFirstTaskOfElement(task, [element])).toBe(true);
    });

    it('returns false for non-first task in element', () => {
      const element = createElement({ id: 'elem-1', taskIds: ['task-1', 'task-2'] });
      const task = createTask({ id: 'task-2', elementId: 'elem-1' });

      expect(isFirstTaskOfElement(task, [element])).toBe(false);
    });

    it('returns false for task with no elementId', () => {
      const element = createElement({ id: 'elem-1', taskIds: ['task-1', 'task-2'] });
      const task = createTask({ id: 'task-1', elementId: undefined });

      expect(isFirstTaskOfElement(task, [element])).toBe(false);
    });

    it('returns false if element not found', () => {
      const task = createTask({ id: 'task-1', elementId: 'nonexistent' });

      expect(isFirstTaskOfElement(task, [])).toBe(false);
    });
  });

  describe('getElementForTask', () => {
    it('returns element for task with elementId', () => {
      const element = createElement({ id: 'elem-1' });
      const task = createTask({ elementId: 'elem-1' });

      const result = getElementForTask(task, [element]);
      expect(result).toBe(element);
    });

    it('returns undefined for task without elementId', () => {
      const element = createElement({ id: 'elem-1' });
      const task = createTask({ elementId: undefined });

      const result = getElementForTask(task, [element]);
      expect(result).toBeUndefined();
    });

    it('returns undefined if element not found', () => {
      const task = createTask({ elementId: 'nonexistent' });

      const result = getElementForTask(task, []);
      expect(result).toBeUndefined();
    });
  });

  describe('getPrerequisiteElements', () => {
    it('returns empty array for element with no prerequisites', () => {
      const element = createElement({ prerequisiteElementIds: [] });

      const result = getPrerequisiteElements(element, []);
      expect(result).toEqual([]);
    });

    it('returns prerequisite elements', () => {
      const prereq1 = createElement({ id: 'elem-couv', suffix: 'COUV' });
      const prereq2 = createElement({ id: 'elem-int', suffix: 'INT' });
      const finElement = createElement({
        id: 'elem-fin',
        suffix: 'FIN',
        prerequisiteElementIds: ['elem-couv', 'elem-int'],
      });

      const allElements = [prereq1, prereq2, finElement];
      const result = getPrerequisiteElements(finElement, allElements);

      expect(result).toHaveLength(2);
      expect(result).toContain(prereq1);
      expect(result).toContain(prereq2);
    });

    it('filters out nonexistent prerequisite IDs', () => {
      const prereq1 = createElement({ id: 'elem-couv', suffix: 'COUV' });
      const finElement = createElement({
        id: 'elem-fin',
        suffix: 'FIN',
        prerequisiteElementIds: ['elem-couv', 'nonexistent'],
      });

      const result = getPrerequisiteElements(finElement, [prereq1, finElement]);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(prereq1);
    });
  });

  describe('getLastTaskAssignment', () => {
    it('returns assignment for last task in element', () => {
      const element = createElement({ taskIds: ['task-1', 'task-2', 'task-3'] });
      const assignments = [
        createAssignment({ id: 'assign-1', taskId: 'task-1' }),
        createAssignment({ id: 'assign-2', taskId: 'task-2' }),
        createAssignment({ id: 'assign-3', taskId: 'task-3' }),
      ];

      const result = getLastTaskAssignment(element, assignments);
      expect(result?.id).toBe('assign-3');
    });

    it('returns undefined if last task not scheduled', () => {
      const element = createElement({ taskIds: ['task-1', 'task-2'] });
      const assignments = [createAssignment({ id: 'assign-1', taskId: 'task-1' })];

      const result = getLastTaskAssignment(element, assignments);
      expect(result).toBeUndefined();
    });

    it('returns undefined for element with no tasks', () => {
      const element = createElement({ taskIds: [] });

      const result = getLastTaskAssignment(element, []);
      expect(result).toBeUndefined();
    });
  });

  describe('getInterElementBound', () => {
    it('returns null for non-first task of element', () => {
      const element = createElement({ id: 'elem-fin', taskIds: ['task-1', 'task-2'] });
      const task = createTask({ id: 'task-2', elementId: 'elem-fin' });

      const result = getInterElementBound(task, [element], []);
      expect(result).toBeNull();
    });

    it('returns null for first task of element without prerequisites', () => {
      const element = createElement({
        id: 'elem-fin',
        taskIds: ['task-1'],
        prerequisiteElementIds: [],
      });
      const task = createTask({ id: 'task-1', elementId: 'elem-fin' });

      const result = getInterElementBound(task, [element], []);
      expect(result).toBeNull();
    });

    it('returns MAX end time of single prerequisite element', () => {
      const prereqElement = createElement({
        id: 'elem-couv',
        taskIds: ['couv-task-1', 'couv-task-2'],
      });
      const finElement = createElement({
        id: 'elem-fin',
        taskIds: ['fin-task-1'],
        prerequisiteElementIds: ['elem-couv'],
      });
      const task = createTask({ id: 'fin-task-1', elementId: 'elem-fin' });
      const assignments = [
        createAssignment({
          taskId: 'couv-task-2',
          scheduledEnd: '2025-01-20T14:00:00Z',
        }),
      ];

      const result = getInterElementBound(task, [prereqElement, finElement], assignments);
      expect(result).not.toBeNull();
      expect(result?.toISOString()).toBe('2025-01-20T14:00:00.000Z');
    });

    it('returns MAX end time of multiple prerequisite elements', () => {
      const couvElement = createElement({
        id: 'elem-couv',
        taskIds: ['couv-task-1', 'couv-task-2'],
      });
      const intElement = createElement({
        id: 'elem-int',
        taskIds: ['int-task-1', 'int-task-2'],
      });
      const finElement = createElement({
        id: 'elem-fin',
        taskIds: ['fin-task-1'],
        prerequisiteElementIds: ['elem-couv', 'elem-int'],
      });
      const task = createTask({ id: 'fin-task-1', elementId: 'elem-fin' });
      const assignments = [
        createAssignment({
          taskId: 'couv-task-2',
          scheduledEnd: '2025-01-20T14:00:00Z', // COUV ends at 14:00
        }),
        createAssignment({
          taskId: 'int-task-2',
          scheduledEnd: '2025-01-20T12:00:00Z', // INT ends at 12:00
        }),
      ];

      const result = getInterElementBound(
        task,
        [couvElement, intElement, finElement],
        assignments
      );

      // Should return MAX(14:00, 12:00) = 14:00
      expect(result).not.toBeNull();
      expect(result?.toISOString()).toBe('2025-01-20T14:00:00.000Z');
    });

    it('returns null if no prerequisites are scheduled', () => {
      const couvElement = createElement({
        id: 'elem-couv',
        taskIds: ['couv-task-1'],
      });
      const finElement = createElement({
        id: 'elem-fin',
        taskIds: ['fin-task-1'],
        prerequisiteElementIds: ['elem-couv'],
      });
      const task = createTask({ id: 'fin-task-1', elementId: 'elem-fin' });

      // No assignments for COUV tasks
      const result = getInterElementBound(task, [couvElement, finElement], []);
      expect(result).toBeNull();
    });

    it('uses only scheduled prerequisites when some are unscheduled', () => {
      const couvElement = createElement({
        id: 'elem-couv',
        taskIds: ['couv-task-1'],
      });
      const intElement = createElement({
        id: 'elem-int',
        taskIds: ['int-task-1'],
      });
      const finElement = createElement({
        id: 'elem-fin',
        taskIds: ['fin-task-1'],
        prerequisiteElementIds: ['elem-couv', 'elem-int'],
      });
      const task = createTask({ id: 'fin-task-1', elementId: 'elem-fin' });
      // Only COUV is scheduled
      const assignments = [
        createAssignment({
          taskId: 'couv-task-1',
          scheduledEnd: '2025-01-20T10:00:00Z',
        }),
      ];

      const result = getInterElementBound(
        task,
        [couvElement, intElement, finElement],
        assignments
      );

      // Should return COUV's end time since INT is not scheduled
      expect(result).not.toBeNull();
      expect(result?.toISOString()).toBe('2025-01-20T10:00:00.000Z');
    });
  });
});
