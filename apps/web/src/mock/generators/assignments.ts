import { faker } from '@faker-js/faker';
import { addMinutes, addHours, startOfDay, addDays, isWithinInterval, parseISO } from 'date-fns';
import type { Assignment, Task, Operator, Equipment, TimeSlot } from '../../types';

interface AssignmentGeneratorInput {
  tasks: Task[];
  operators: Operator[];
  equipment: Equipment[];
  startDate: Date;
}

export function generateAssignments({
  tasks,
  operators,
  equipment,
  startDate,
}: AssignmentGeneratorInput): Assignment[] {
  const assignments: Assignment[] = [];
  const occupiedSlots: Map<string, TimeSlot[]> = new Map();

  // Filter assignable tasks
  const assignableTasks = tasks.filter(
    (t) => t.status === 'Assigned' || t.status === 'Executing'
  );

  // Sort by dependencies (tasks with no dependencies first)
  const sortedTasks = [...assignableTasks].sort(
    (a, b) => a.dependencies.length - b.dependencies.length
  );

  for (const task of sortedTasks) {
    // Find available operator if required
    let operatorId: string | null = null;
    if (task.requiresOperator) {
      const availableOperators = operators.filter(
        (op) => op.status === 'Active' && op.skills.length > 0
      );
      if (availableOperators.length > 0) {
        operatorId = faker.helpers.arrayElement(availableOperators).id;
      }
    }

    // Find available equipment if required
    let equipmentId: string | null = null;
    if (task.requiresEquipment) {
      const compatibleEquipment = equipment.filter(
        (eq) =>
          (eq.status === 'Available' || eq.status === 'InUse') &&
          eq.supportedTaskTypes.some((t) => t === task.type || task.type.includes(t))
      );
      if (compatibleEquipment.length > 0) {
        equipmentId = faker.helpers.arrayElement(compatibleEquipment).id;
      } else {
        // Fallback to any available equipment
        const anyEquipment = equipment.filter(
          (eq) => eq.status === 'Available' || eq.status === 'InUse'
        );
        if (anyEquipment.length > 0) {
          equipmentId = faker.helpers.arrayElement(anyEquipment).id;
        }
      }
    }

    // Skip if we can't assign required resources
    if (task.requiresOperator && !operatorId) continue;
    if (task.requiresEquipment && !equipmentId) continue;

    // Generate a random start time within the schedule window
    const dayOffset = faker.number.int({ min: 0, max: 10 });
    const hourOffset = faker.number.int({ min: 6, max: 16 });
    const scheduledStart = addHours(
      startOfDay(addDays(startDate, dayOffset)),
      hourOffset
    );
    const scheduledEnd = addMinutes(scheduledStart, task.duration);

    assignments.push({
      id: faker.string.uuid(),
      taskId: task.id,
      operatorId,
      equipmentId,
      scheduledStart: scheduledStart.toISOString(),
      scheduledEnd: scheduledEnd.toISOString(),
    });
  }

  return assignments;
}
