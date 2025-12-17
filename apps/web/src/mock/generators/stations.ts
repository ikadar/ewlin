/**
 * Station Generators
 * Generate mock stations, categories, groups, and providers for testing.
 */

import type {
  Station,
  StationCategory,
  StationGroup,
  OperatingSchedule,
  DaySchedule,
  TimeSlot,
  ScheduleException,
  SimilarityCriterion,
  OutsourcedProvider,
  StationStatus,
  ProviderStatus,
} from '@flux/types';

// ============================================================================
// Similarity Criteria
// ============================================================================

const OFFSET_PRESS_CRITERIA: SimilarityCriterion[] = [
  { id: 'crit-paper-type', name: 'Même type de papier', fieldPath: 'paperType' },
  { id: 'crit-paper-format', name: 'Même format', fieldPath: 'paperFormat' },
  { id: 'crit-inking', name: 'Même encrage', fieldPath: 'inking' },
];

const FINISHING_CRITERIA: SimilarityCriterion[] = [
  { id: 'crit-paper-weight', name: 'Même grammage', fieldPath: 'paperWeight' },
  { id: 'crit-paper-format', name: 'Même format', fieldPath: 'paperFormat' },
];

const CUTTING_CRITERIA: SimilarityCriterion[] = [
  { id: 'crit-paper-format', name: 'Même format', fieldPath: 'paperFormat' },
];

// ============================================================================
// Station Categories
// ============================================================================

export function generateStationCategories(): StationCategory[] {
  return [
    {
      id: 'cat-offset',
      name: 'Presses Offset',
      description: 'Machines d\'impression offset',
      similarityCriteria: OFFSET_PRESS_CRITERIA,
    },
    {
      id: 'cat-digital',
      name: 'Impression Numérique',
      description: 'Machines d\'impression numérique',
      similarityCriteria: [
        { id: 'crit-paper-type', name: 'Même type de papier', fieldPath: 'paperType' },
      ],
    },
    {
      id: 'cat-cutting',
      name: 'Massicots',
      description: 'Machines de découpe',
      similarityCriteria: CUTTING_CRITERIA,
    },
    {
      id: 'cat-finishing',
      name: 'Finition',
      description: 'Machines de finition (pliage, reliure, etc.)',
      similarityCriteria: FINISHING_CRITERIA,
    },
    {
      id: 'cat-outsourced',
      name: 'Sous-traitance',
      description: 'Travaux externalisés',
      similarityCriteria: [],
    },
  ];
}

// ============================================================================
// Station Groups
// ============================================================================

export function generateStationGroups(): StationGroup[] {
  return [
    {
      id: 'grp-offset',
      name: 'Presses Offset',
      maxConcurrent: 2,
      isOutsourcedProviderGroup: false,
    },
    {
      id: 'grp-digital',
      name: 'Impression Numérique',
      maxConcurrent: 2,
      isOutsourcedProviderGroup: false,
    },
    {
      id: 'grp-cutting',
      name: 'Massicots',
      maxConcurrent: 1,
      isOutsourcedProviderGroup: false,
    },
    {
      id: 'grp-finishing',
      name: 'Finition',
      maxConcurrent: 3,
      isOutsourcedProviderGroup: false,
    },
    // Provider groups (unlimited capacity)
    {
      id: 'grp-clement',
      name: 'Clément',
      maxConcurrent: null,
      isOutsourcedProviderGroup: true,
    },
    {
      id: 'grp-reliure',
      name: 'Reliure Express',
      maxConcurrent: null,
      isOutsourcedProviderGroup: true,
    },
  ];
}

// ============================================================================
// Operating Schedules
// ============================================================================

function createDaySchedule(isOperating: boolean, slots: TimeSlot[] = []): DaySchedule {
  return { isOperating, slots };
}

function createStandardWorkday(): DaySchedule {
  return createDaySchedule(true, [
    { start: '06:00', end: '12:00' },
    { start: '13:00', end: '22:00' },
  ]);
}

function createExtendedWorkday(): DaySchedule {
  return createDaySchedule(true, [
    { start: '00:00', end: '05:00' },
    { start: '06:00', end: '24:00' },
  ]);
}

function createClosedDay(): DaySchedule {
  return createDaySchedule(false, []);
}

export function generateOperatingSchedule(type: 'standard' | 'extended' | '24h' = 'standard'): OperatingSchedule {
  if (type === '24h') {
    const fullDay = createDaySchedule(true, [{ start: '00:00', end: '24:00' }]);
    return {
      monday: fullDay,
      tuesday: fullDay,
      wednesday: fullDay,
      thursday: fullDay,
      friday: fullDay,
      saturday: createClosedDay(),
      sunday: createClosedDay(),
    };
  }

  if (type === 'extended') {
    return {
      monday: createExtendedWorkday(),
      tuesday: createExtendedWorkday(),
      wednesday: createExtendedWorkday(),
      thursday: createExtendedWorkday(),
      friday: createExtendedWorkday(),
      saturday: createClosedDay(),
      sunday: createClosedDay(),
    };
  }

  // Standard schedule
  return {
    monday: createStandardWorkday(),
    tuesday: createStandardWorkday(),
    wednesday: createStandardWorkday(),
    thursday: createStandardWorkday(),
    friday: createStandardWorkday(),
    saturday: createClosedDay(),
    sunday: createClosedDay(),
  };
}

export function generateScheduleExceptions(stationId: string): ScheduleException[] {
  // Generate a few schedule exceptions for testing
  const today = new Date();
  const nextMonth = new Date(today);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  return [
    {
      id: `exc-${stationId}-christmas`,
      date: `${today.getFullYear()}-12-25`,
      schedule: createClosedDay(),
      reason: 'Noël',
    },
    {
      id: `exc-${stationId}-newyear`,
      date: `${today.getFullYear() + 1}-01-01`,
      schedule: createClosedDay(),
      reason: 'Jour de l\'an',
    },
  ];
}

// ============================================================================
// Stations
// ============================================================================

interface StationDefinition {
  id: string;
  name: string;
  categoryId: string;
  groupId: string;
  scheduleType: 'standard' | 'extended' | '24h';
}

const STATION_DEFINITIONS: StationDefinition[] = [
  // Offset presses
  { id: 'sta-komori-g40', name: 'Komori G40', categoryId: 'cat-offset', groupId: 'grp-offset', scheduleType: 'extended' },
  { id: 'sta-heidelberg-sm', name: 'Heidelberg Speedmaster', categoryId: 'cat-offset', groupId: 'grp-offset', scheduleType: 'extended' },
  { id: 'sta-komori-ls', name: 'Komori LS29', categoryId: 'cat-offset', groupId: 'grp-offset', scheduleType: 'standard' },

  // Digital presses
  { id: 'sta-xerox', name: 'Xerox Versant', categoryId: 'cat-digital', groupId: 'grp-digital', scheduleType: 'standard' },
  { id: 'sta-hp-indigo', name: 'HP Indigo 7900', categoryId: 'cat-digital', groupId: 'grp-digital', scheduleType: 'standard' },

  // Cutters
  { id: 'sta-polar-137', name: 'Polar 137', categoryId: 'cat-cutting', groupId: 'grp-cutting', scheduleType: 'standard' },
  { id: 'sta-massicot', name: 'Massicot Ideal', categoryId: 'cat-cutting', groupId: 'grp-cutting', scheduleType: 'standard' },

  // Finishing
  { id: 'sta-stahl', name: 'Stahl TH82', categoryId: 'cat-finishing', groupId: 'grp-finishing', scheduleType: 'standard' },
  { id: 'sta-muller', name: 'Muller Martini', categoryId: 'cat-finishing', groupId: 'grp-finishing', scheduleType: 'standard' },
  { id: 'sta-horizon', name: 'Horizon BQ-270', categoryId: 'cat-finishing', groupId: 'grp-finishing', scheduleType: 'standard' },
];

export function generateStations(): Station[] {
  return STATION_DEFINITIONS.map((def): Station => ({
    id: def.id,
    name: def.name,
    status: 'Available' as StationStatus,
    categoryId: def.categoryId,
    groupId: def.groupId,
    capacity: 1,
    operatingSchedule: generateOperatingSchedule(def.scheduleType),
    exceptions: generateScheduleExceptions(def.id),
  }));
}

// ============================================================================
// Outsourced Providers
// ============================================================================

export function generateProviders(): OutsourcedProvider[] {
  return [
    {
      id: 'prov-clement',
      name: 'Clément',
      status: 'Active' as ProviderStatus,
      supportedActionTypes: ['Pelliculage', 'Dorure', 'Vernis UV', 'Gaufrage'],
      latestDepartureTime: '14:00',
      receptionTime: '09:00',
      groupId: 'grp-clement',
    },
    {
      id: 'prov-reliure',
      name: 'Reliure Express',
      status: 'Active' as ProviderStatus,
      supportedActionTypes: ['Reliure dos carré collé', 'Reliure spirale', 'Reliure Wire-O'],
      latestDepartureTime: '12:00',
      receptionTime: '10:00',
      groupId: 'grp-reliure',
    },
  ];
}

// ============================================================================
// Combined Generator
// ============================================================================

export interface StationData {
  categories: StationCategory[];
  groups: StationGroup[];
  stations: Station[];
  providers: OutsourcedProvider[];
}

export function generateAllStationData(): StationData {
  return {
    categories: generateStationCategories(),
    groups: generateStationGroups(),
    stations: generateStations(),
    providers: generateProviders(),
  };
}
