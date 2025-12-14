import type {
  Station,
  StationCategory,
  StationGroup,
  OutsourcedProvider,
} from '../../types';
import {
  generateStations,
  generateCategories,
  generateGroups,
  generateProviders,
  generateAllGroups,
  generateProviderGroups,
} from '../generators/stations';

// Re-export generators with factory naming
export const stationFactory = {
  /**
   * Generate all default stations (10 stations)
   */
  createMany: (): Station[] => generateStations(),

  /**
   * Create a single station by ID from the default set
   */
  findById: (id: string): Station | undefined => {
    return generateStations().find((s) => s.id === id);
  },

  /**
   * Get stations by category
   */
  findByCategory: (categoryId: string): Station[] => {
    return generateStations().filter((s) => s.categoryId === categoryId);
  },

  /**
   * Get stations by group
   */
  findByGroup: (groupId: string): Station[] => {
    return generateStations().filter((s) => s.groupId === groupId);
  },
};

export const categoryFactory = {
  /**
   * Generate all station categories (5 categories)
   */
  createMany: (): StationCategory[] => generateCategories(),

  /**
   * Create a single category by ID
   */
  findById: (id: string): StationCategory | undefined => {
    return generateCategories().find((c) => c.id === id);
  },
};

export const groupFactory = {
  /**
   * Generate station groups (4 groups)
   */
  createStationGroups: (): StationGroup[] => generateGroups(),

  /**
   * Generate provider groups (auto-generated from providers)
   */
  createProviderGroups: (): StationGroup[] => generateProviderGroups(),

  /**
   * Generate all groups (stations + providers)
   */
  createAll: (): StationGroup[] => generateAllGroups(),

  /**
   * Find a group by ID
   */
  findById: (id: string): StationGroup | undefined => {
    return generateAllGroups().find((g) => g.id === id);
  },
};

export const providerFactory = {
  /**
   * Generate all outsourced providers (3 providers)
   */
  createMany: (): OutsourcedProvider[] => generateProviders(),

  /**
   * Find a provider by ID
   */
  findById: (id: string): OutsourcedProvider | undefined => {
    return generateProviders().find((p) => p.id === id);
  },

  /**
   * Get providers supporting a specific action type
   */
  findByActionType: (actionType: string): OutsourcedProvider[] => {
    return generateProviders().filter((p) =>
      p.supportedActionTypes.includes(actionType)
    );
  },
};
