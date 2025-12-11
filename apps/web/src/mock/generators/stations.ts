import type {
  Station,
  StationCategory,
  StationGroup,
  OutsourcedProvider,
  OperatingSchedule,
  SimilarityCriterion,
} from '../../types';

// Default operating schedule: Monday-Friday, 6:00-12:00 and 13:00-17:00 (with lunch break)
const defaultOperatingSchedule: OperatingSchedule = {
  weeklyPattern: [
    { dayOfWeek: 1, timeSlots: [{ start: '06:00', end: '12:00' }, { start: '13:00', end: '17:00' }] }, // Monday
    { dayOfWeek: 2, timeSlots: [{ start: '06:00', end: '12:00' }, { start: '13:00', end: '17:00' }] }, // Tuesday
    { dayOfWeek: 3, timeSlots: [{ start: '06:00', end: '12:00' }, { start: '13:00', end: '17:00' }] }, // Wednesday
    { dayOfWeek: 4, timeSlots: [{ start: '06:00', end: '12:00' }, { start: '13:00', end: '17:00' }] }, // Thursday
    { dayOfWeek: 5, timeSlots: [{ start: '06:00', end: '12:00' }, { start: '13:00', end: '17:00' }] }, // Friday
  ],
};

// Extended schedule for high-demand stations
const extendedOperatingSchedule: OperatingSchedule = {
  weeklyPattern: [
    { dayOfWeek: 1, timeSlots: [{ start: '05:00', end: '21:00' }] },
    { dayOfWeek: 2, timeSlots: [{ start: '05:00', end: '21:00' }] },
    { dayOfWeek: 3, timeSlots: [{ start: '05:00', end: '21:00' }] },
    { dayOfWeek: 4, timeSlots: [{ start: '05:00', end: '21:00' }] },
    { dayOfWeek: 5, timeSlots: [{ start: '05:00', end: '21:00' }] },
    { dayOfWeek: 6, timeSlots: [{ start: '06:00', end: '12:00' }] }, // Saturday morning
  ],
};

// Station Categories
export function generateCategories(): StationCategory[] {
  return [
    {
      id: 'cat-offset',
      name: 'Offset Printing Press',
      similarityCriteria: [
        { code: 'paper_type', name: 'Same paper type' },
        { code: 'paper_size', name: 'Same paper size' },
        { code: 'paper_weight', name: 'Same paper weight' },
        { code: 'inking', name: 'Same inking' },
      ],
    },
    {
      id: 'cat-digital',
      name: 'Digital Press',
      similarityCriteria: [
        { code: 'paper_type', name: 'Same paper type' },
        { code: 'paper_size', name: 'Same paper size' },
      ],
    },
    {
      id: 'cat-finishing',
      name: 'Finishing Equipment',
      similarityCriteria: [
        { code: 'paper_weight', name: 'Same paper weight' },
      ],
    },
    {
      id: 'cat-cutting',
      name: 'Cutting Equipment',
      similarityCriteria: [
        { code: 'paper_size', name: 'Same paper size' },
      ],
    },
    {
      id: 'cat-binding',
      name: 'Binding Equipment',
      similarityCriteria: [
        { code: 'binding_type', name: 'Same binding type' },
      ],
    },
  ];
}

// Station Groups
export function generateGroups(): StationGroup[] {
  return [
    {
      id: 'grp-offset',
      name: 'Offset Presses',
      maxConcurrent: 2, // Only 2 offset presses can run simultaneously (operator limitation)
      isOutsourcedProviderGroup: false,
    },
    {
      id: 'grp-digital',
      name: 'Digital Presses',
      maxConcurrent: null, // Unlimited
      isOutsourcedProviderGroup: false,
    },
    {
      id: 'grp-finishing',
      name: 'Finishing',
      maxConcurrent: 3,
      isOutsourcedProviderGroup: false,
    },
    {
      id: 'grp-cutting',
      name: 'Cutting',
      maxConcurrent: 1, // Only one cutting job at a time
      isOutsourcedProviderGroup: false,
    },
  ];
}

// Stations
export function generateStations(): Station[] {
  return [
    // Offset Presses
    {
      id: 'station-komori-g37',
      name: 'Komori G37',
      categoryId: 'cat-offset',
      groupId: 'grp-offset',
      capacity: 1,
      status: 'Available',
      operatingSchedule: extendedOperatingSchedule,
      exceptions: [],
    },
    {
      id: 'station-komori-xl',
      name: 'Komori XL 106',
      categoryId: 'cat-offset',
      groupId: 'grp-offset',
      capacity: 1,
      status: 'Available',
      operatingSchedule: extendedOperatingSchedule,
      exceptions: [],
    },
    {
      id: 'station-heidelberg',
      name: 'Heidelberg SM 52',
      categoryId: 'cat-offset',
      groupId: 'grp-offset',
      capacity: 1,
      status: 'Available',
      operatingSchedule: defaultOperatingSchedule,
      exceptions: [],
    },
    // Digital Presses
    {
      id: 'station-xerox',
      name: 'Xerox Iridesse',
      categoryId: 'cat-digital',
      groupId: 'grp-digital',
      capacity: 1,
      status: 'Available',
      operatingSchedule: defaultOperatingSchedule,
      exceptions: [],
    },
    {
      id: 'station-canon',
      name: 'Canon imagePRESS',
      categoryId: 'cat-digital',
      groupId: 'grp-digital',
      capacity: 1,
      status: 'Available',
      operatingSchedule: defaultOperatingSchedule,
      exceptions: [],
    },
    // Finishing
    {
      id: 'station-vernisseuse',
      name: 'Vernisseuse UV',
      categoryId: 'cat-finishing',
      groupId: 'grp-finishing',
      capacity: 1,
      status: 'Available',
      operatingSchedule: defaultOperatingSchedule,
      exceptions: [],
    },
    {
      id: 'station-plieuse',
      name: 'Plieuse MBO',
      categoryId: 'cat-finishing',
      groupId: 'grp-finishing',
      capacity: 1,
      status: 'Available',
      operatingSchedule: defaultOperatingSchedule,
      exceptions: [],
    },
    // Cutting
    {
      id: 'station-massicot',
      name: 'Massicot Polar',
      categoryId: 'cat-cutting',
      groupId: 'grp-cutting',
      capacity: 1,
      status: 'Available',
      operatingSchedule: extendedOperatingSchedule,
      exceptions: [],
    },
    // Binding
    {
      id: 'station-reliure',
      name: 'Reliure Horizon',
      categoryId: 'cat-binding',
      groupId: null,
      capacity: 1,
      status: 'Available',
      operatingSchedule: defaultOperatingSchedule,
      exceptions: [],
    },
    // Packaging/Conditioning
    {
      id: 'station-conditionnement',
      name: 'Conditionnement',
      categoryId: 'cat-finishing',
      groupId: null,
      capacity: 1,
      status: 'Available',
      operatingSchedule: defaultOperatingSchedule,
      exceptions: [],
    },
  ];
}

// Outsourced Providers
export function generateProviders(): OutsourcedProvider[] {
  return [
    {
      id: 'prov-clement',
      name: 'Clément',
      supportedActionTypes: ['Pelliculage', 'Dorure', 'Gaufrage'],
      groupId: 'grp-prov-clement',
      status: 'Active',
    },
    {
      id: 'prov-abc',
      name: 'ABC Finishing',
      supportedActionTypes: ['Reliure', 'Dorure', 'Découpe'],
      groupId: 'grp-prov-abc',
      status: 'Active',
    },
    {
      id: 'prov-express',
      name: 'Express Logistics',
      supportedActionTypes: ['Transport', 'Livraison'],
      groupId: 'grp-prov-express',
      status: 'Active',
    },
  ];
}

// Provider groups (auto-generated, unlimited capacity)
export function generateProviderGroups(): StationGroup[] {
  const providers = generateProviders();
  return providers.map((provider) => ({
    id: provider.groupId,
    name: `${provider.name} (Provider)`,
    maxConcurrent: null, // Providers have unlimited capacity
    isOutsourcedProviderGroup: true,
  }));
}

// Get all groups (stations + providers)
export function generateAllGroups(): StationGroup[] {
  return [...generateGroups(), ...generateProviderGroups()];
}
