import { faker } from '@faker-js/faker';
import { addHours, startOfDay, addDays } from 'date-fns';
import type { Equipment, EquipmentStatus, TimeSlot } from '../../types';

const EQUIPMENT_TYPES = [
  { name: 'CNC Mill', types: ['CNC', 'Milling'] },
  { name: 'Lathe', types: ['Turning', 'Machining'] },
  { name: 'Laser Cutter', types: ['Cutting', 'Engraving'] },
  { name: '3D Printer', types: ['Additive', 'Prototyping'] },
  { name: 'Assembly Station', types: ['Assembly', 'QC'] },
  { name: 'Welding Robot', types: ['Welding', 'Fabrication'] },
  { name: 'Press Brake', types: ['Bending', 'Forming'] },
  { name: 'Injection Molder', types: ['Molding', 'Plastics'] },
  { name: 'Paint Booth', types: ['Painting', 'Finishing'] },
  { name: 'Inspection Station', types: ['QC', 'Testing'] },
];

const LOCATIONS = [
  'Hall A - North',
  'Hall A - South',
  'Hall B - East',
  'Hall B - West',
  'Workshop 1',
  'Workshop 2',
  'Clean Room',
  'Assembly Area',
];

export function generateMaintenanceWindows(
  startDate: Date,
  daysCount: number = 14
): TimeSlot[] {
  const windows: TimeSlot[] = [];

  // Add 1-2 maintenance windows in the period
  const maintenanceCount = faker.number.int({ min: 0, max: 2 });

  for (let i = 0; i < maintenanceCount; i++) {
    const day = faker.number.int({ min: 0, max: daysCount - 1 });
    const currentDay = addDays(startDate, day);
    const startHour = faker.number.int({ min: 6, max: 18 });
    const duration = faker.number.int({ min: 2, max: 6 });

    windows.push({
      start: addHours(startOfDay(currentDay), startHour).toISOString(),
      end: addHours(startOfDay(currentDay), startHour + duration).toISOString(),
    });
  }

  return windows;
}

export function generateEquipment(
  count: number = 15,
  startDate: Date = new Date()
): Equipment[] {
  const usedNames = new Set<string>();

  return Array.from({ length: count }, () => {
    // Pick a type or create a unique name
    let equipmentType = faker.helpers.arrayElement(EQUIPMENT_TYPES);
    let name = equipmentType.name;
    let counter = 1;

    while (usedNames.has(name)) {
      counter++;
      name = `${equipmentType.name} ${counter}`;
    }
    usedNames.add(name);

    const status: EquipmentStatus = faker.helpers.weightedArrayElement([
      { weight: 70, value: 'Available' as const },
      { weight: 15, value: 'InUse' as const },
      { weight: 10, value: 'Maintenance' as const },
      { weight: 5, value: 'OutOfService' as const },
    ]);

    return {
      id: faker.string.uuid(),
      name,
      status,
      supportedTaskTypes: equipmentType.types,
      location: faker.helpers.arrayElement(LOCATIONS),
      maintenanceWindows: status !== 'OutOfService' ? generateMaintenanceWindows(startDate) : [],
    };
  });
}
