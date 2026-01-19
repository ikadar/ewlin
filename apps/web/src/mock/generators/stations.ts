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
      name: 'Presse offset',
      description: 'Presses offset',
      similarityCriteria: OFFSET_PRESS_CRITERIA,
    },
    {
      id: 'cat-digital',
      name: 'Presse numérique',
      description: 'Presses numériques',
      similarityCriteria: [
        { id: 'crit-paper-type', name: 'Même type de papier', fieldPath: 'paperType' },
      ],
    },
    {
      id: 'cat-cutting',
      name: 'Massicot',
      description: 'Massicots',
      similarityCriteria: CUTTING_CRITERIA,
    },
    {
      id: 'cat-typo',
      name: 'Typo',
      description: 'Machines typographiques',
      similarityCriteria: [],
    },
    {
      id: 'cat-folding',
      name: 'Plieuse',
      description: 'Plieuses',
      similarityCriteria: FINISHING_CRITERIA,
    },
    {
      id: 'cat-saddle-stitch',
      name: 'Encarteuse-piqueuse',
      description: 'Encarteuses-piqueuses',
      similarityCriteria: [],
    },
    {
      id: 'cat-booklet',
      name: 'Assembleuse-piqueuse',
      description: 'Assembleuses-piqueuses',
      similarityCriteria: [],
    },
    {
      id: 'cat-packaging',
      name: 'Conditionnement',
      description: 'Conditionnement',
      similarityCriteria: [],
    },
  ];
}

// ============================================================================
// Station Groups (same as categories)
// ============================================================================

export function generateStationGroups(): StationGroup[] {
  return [
    {
      id: 'grp-offset',
      name: 'Presse offset',
      maxConcurrent: 999,
      isOutsourcedProviderGroup: false,
    },
    {
      id: 'grp-digital',
      name: 'Presse numérique',
      maxConcurrent: 999,
      isOutsourcedProviderGroup: false,
    },
    {
      id: 'grp-cutting',
      name: 'Massicot',
      maxConcurrent: 999,
      isOutsourcedProviderGroup: false,
    },
    {
      id: 'grp-typo',
      name: 'Typo',
      maxConcurrent: 999,
      isOutsourcedProviderGroup: false,
    },
    {
      id: 'grp-folding',
      name: 'Plieuse',
      maxConcurrent: 999,
      isOutsourcedProviderGroup: false,
    },
    {
      id: 'grp-saddle-stitch',
      name: 'Encarteuse-piqueuse',
      maxConcurrent: 999,
      isOutsourcedProviderGroup: false,
    },
    {
      id: 'grp-booklet',
      name: 'Assembleuse-piqueuse',
      maxConcurrent: 999,
      isOutsourcedProviderGroup: false,
    },
    {
      id: 'grp-packaging',
      name: 'Conditionnement',
      maxConcurrent: 999,
      isOutsourcedProviderGroup: false,
    },
    // Outsourced provider groups (unlimited capacity)
    {
      id: 'grp-clement',
      name: 'Clément (Sous-traitant)',
      maxConcurrent: null,
      isOutsourcedProviderGroup: true,
    },
    {
      id: 'grp-reliure',
      name: 'Reliure Express (Sous-traitant)',
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
  // Presse offset
  { id: 'sta-g37', name: 'G37', categoryId: 'cat-offset', groupId: 'grp-offset', scheduleType: 'standard' },
  { id: 'sta-754', name: '754', categoryId: 'cat-offset', groupId: 'grp-offset', scheduleType: 'standard' },
  { id: 'sta-gto', name: 'GTO', categoryId: 'cat-offset', groupId: 'grp-offset', scheduleType: 'standard' },

  // Presse numérique
  { id: 'sta-c9500', name: 'C9500', categoryId: 'cat-digital', groupId: 'grp-digital', scheduleType: 'standard' },

  // Massicot
  { id: 'sta-p137', name: 'P137', categoryId: 'cat-cutting', groupId: 'grp-cutting', scheduleType: 'standard' },
  { id: 'sta-vm', name: 'VM', categoryId: 'cat-cutting', groupId: 'grp-cutting', scheduleType: 'standard' },

  // Typo
  { id: 'sta-sbg', name: 'SBG', categoryId: 'cat-typo', groupId: 'grp-typo', scheduleType: 'standard' },
  { id: 'sta-sbb', name: 'SBB', categoryId: 'cat-typo', groupId: 'grp-typo', scheduleType: 'standard' },

  // Plieuse
  { id: 'sta-stahl', name: 'Stahl', categoryId: 'cat-folding', groupId: 'grp-folding', scheduleType: 'standard' },
  { id: 'sta-mbo', name: 'MBO', categoryId: 'cat-folding', groupId: 'grp-folding', scheduleType: 'standard' },
  { id: 'sta-horizon', name: 'Horizon', categoryId: 'cat-folding', groupId: 'grp-folding', scheduleType: 'standard' },

  // Encarteuse-piqueuse
  { id: 'sta-h', name: 'H', categoryId: 'cat-saddle-stitch', groupId: 'grp-saddle-stitch', scheduleType: 'standard' },

  // Assembleuse-piqueuse
  { id: 'sta-duplo10', name: 'Duplo10', categoryId: 'cat-booklet', groupId: 'grp-booklet', scheduleType: 'standard' },
  { id: 'sta-duplo20', name: 'Duplo20', categoryId: 'cat-booklet', groupId: 'grp-booklet', scheduleType: 'standard' },

  // Conditionnement
  { id: 'sta-carton', name: 'Carton', categoryId: 'cat-packaging', groupId: 'grp-packaging', scheduleType: 'standard' },
  { id: 'sta-film', name: 'Film', categoryId: 'cat-packaging', groupId: 'grp-packaging', scheduleType: 'standard' },
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
