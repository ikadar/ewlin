import { faker } from '@faker-js/faker';
import { addHours, format, startOfDay, addDays } from 'date-fns';
import type { Operator, OperatorStatus, OperatorSkill, TimeSlot, SkillLevel } from '../../types';

const SKILL_LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'expert'];

export function generateAvailabilitySlots(
  startDate: Date,
  daysCount: number = 14
): TimeSlot[] {
  const slots: TimeSlot[] = [];

  for (let day = 0; day < daysCount; day++) {
    const currentDay = addDays(startDate, day);
    const dayOfWeek = currentDay.getDay();

    // Skip weekends occasionally
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      if (faker.datatype.boolean(0.7)) continue;
    }

    // Morning shift: 6:00 - 14:00
    // Afternoon shift: 14:00 - 22:00
    // Full day: 8:00 - 17:00
    const shiftType = faker.helpers.arrayElement(['morning', 'afternoon', 'full', 'full']);

    let start: Date;
    let end: Date;

    if (shiftType === 'morning') {
      start = addHours(startOfDay(currentDay), 6);
      end = addHours(startOfDay(currentDay), 14);
    } else if (shiftType === 'afternoon') {
      start = addHours(startOfDay(currentDay), 14);
      end = addHours(startOfDay(currentDay), 22);
    } else {
      start = addHours(startOfDay(currentDay), 8);
      end = addHours(startOfDay(currentDay), 17);
    }

    slots.push({
      start: start.toISOString(),
      end: end.toISOString(),
    });
  }

  return slots;
}

export function generateSkills(equipmentIds: string[]): OperatorSkill[] {
  const skillCount = faker.number.int({ min: 1, max: Math.min(5, equipmentIds.length) });
  const selectedEquipment = faker.helpers.arrayElements(equipmentIds, skillCount);

  return selectedEquipment.map((equipmentId) => ({
    equipmentId,
    level: faker.helpers.arrayElement(SKILL_LEVELS),
  }));
}

export function generateOperators(
  count: number = 20,
  equipmentIds: string[],
  startDate: Date = new Date()
): Operator[] {
  return Array.from({ length: count }, () => {
    const status: OperatorStatus = faker.helpers.weightedArrayElement([
      { weight: 80, value: 'Active' as const },
      { weight: 15, value: 'Inactive' as const },
      { weight: 5, value: 'Deactivated' as const },
    ]);

    return {
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      status,
      availability: status === 'Active' ? generateAvailabilitySlots(startDate) : [],
      skills: generateSkills(equipmentIds),
    };
  });
}
