/**
 * Station Generator Tests
 */

import { describe, it, expect } from 'vitest';
import {
  generateStationCategories,
  generateStationGroups,
  generateOperatingSchedule,
  generateStations,
  generateProviders,
  generateAllStationData,
} from './stations';

describe('generateStationCategories', () => {
  it('returns an array of station categories', () => {
    const categories = generateStationCategories();
    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBeGreaterThan(0);
  });

  it('each category has required fields', () => {
    const categories = generateStationCategories();
    for (const category of categories) {
      expect(category).toHaveProperty('id');
      expect(category).toHaveProperty('name');
      expect(category).toHaveProperty('similarityCriteria');
      expect(Array.isArray(category.similarityCriteria)).toBe(true);
    }
  });

  it('includes offset press category with similarity criteria', () => {
    const categories = generateStationCategories();
    const offsetCategory = categories.find((c) => c.id === 'cat-offset');
    expect(offsetCategory).toBeDefined();
    expect(offsetCategory?.similarityCriteria.length).toBeGreaterThan(0);
  });
});

describe('generateStationGroups', () => {
  it('returns an array of station groups', () => {
    const groups = generateStationGroups();
    expect(Array.isArray(groups)).toBe(true);
    expect(groups.length).toBeGreaterThan(0);
  });

  it('each group has required fields', () => {
    const groups = generateStationGroups();
    for (const group of groups) {
      expect(group).toHaveProperty('id');
      expect(group).toHaveProperty('name');
      expect(group).toHaveProperty('maxConcurrent');
      expect(group).toHaveProperty('isOutsourcedProviderGroup');
    }
  });

  it('includes outsourced provider groups with unlimited capacity', () => {
    const groups = generateStationGroups();
    const providerGroups = groups.filter((g) => g.isOutsourcedProviderGroup);
    expect(providerGroups.length).toBeGreaterThan(0);
    for (const group of providerGroups) {
      expect(group.maxConcurrent).toBeNull();
    }
  });
});

describe('generateOperatingSchedule', () => {
  it('returns a valid operating schedule with all days', () => {
    const schedule = generateOperatingSchedule();
    expect(schedule).toHaveProperty('monday');
    expect(schedule).toHaveProperty('tuesday');
    expect(schedule).toHaveProperty('wednesday');
    expect(schedule).toHaveProperty('thursday');
    expect(schedule).toHaveProperty('friday');
    expect(schedule).toHaveProperty('saturday');
    expect(schedule).toHaveProperty('sunday');
  });

  it('standard schedule has weekends closed', () => {
    const schedule = generateOperatingSchedule('standard');
    expect(schedule.saturday.isOperating).toBe(false);
    expect(schedule.sunday.isOperating).toBe(false);
  });

  it('standard schedule has weekdays open with slots', () => {
    const schedule = generateOperatingSchedule('standard');
    expect(schedule.monday.isOperating).toBe(true);
    expect(schedule.monday.slots.length).toBeGreaterThan(0);
  });

  it('each time slot has start and end', () => {
    const schedule = generateOperatingSchedule('standard');
    for (const slot of schedule.monday.slots) {
      expect(slot).toHaveProperty('start');
      expect(slot).toHaveProperty('end');
      expect(slot.start).toMatch(/^\d{2}:\d{2}$/);
      expect(slot.end).toMatch(/^\d{2}:\d{2}$/);
    }
  });
});

describe('generateStations', () => {
  it('returns an array of stations', () => {
    const stations = generateStations();
    expect(Array.isArray(stations)).toBe(true);
    expect(stations.length).toBeGreaterThan(0);
  });

  it('each station has required fields', () => {
    const stations = generateStations();
    for (const station of stations) {
      expect(station).toHaveProperty('id');
      expect(station).toHaveProperty('name');
      expect(station).toHaveProperty('status');
      expect(station).toHaveProperty('categoryId');
      expect(station).toHaveProperty('groupId');
      expect(station).toHaveProperty('capacity');
      expect(station).toHaveProperty('operatingSchedule');
      expect(station).toHaveProperty('exceptions');
    }
  });

  it('includes French press names', () => {
    const stations = generateStations();
    const stationNames = stations.map((s) => s.name);
    expect(stationNames).toContain('Komori G40');
    expect(stationNames).toContain('Polar 137');
  });

  it('all stations have capacity 1', () => {
    const stations = generateStations();
    for (const station of stations) {
      expect(station.capacity).toBe(1);
    }
  });
});

describe('generateProviders', () => {
  it('returns an array of providers', () => {
    const providers = generateProviders();
    expect(Array.isArray(providers)).toBe(true);
    expect(providers.length).toBeGreaterThan(0);
  });

  it('each provider has required fields', () => {
    const providers = generateProviders();
    for (const provider of providers) {
      expect(provider).toHaveProperty('id');
      expect(provider).toHaveProperty('name');
      expect(provider).toHaveProperty('status');
      expect(provider).toHaveProperty('supportedActionTypes');
      expect(provider).toHaveProperty('latestDepartureTime');
      expect(provider).toHaveProperty('receptionTime');
      expect(provider).toHaveProperty('groupId');
    }
  });

  it('includes Clément provider with pelliculage', () => {
    const providers = generateProviders();
    const clement = providers.find((p) => p.name === 'Clément');
    expect(clement).toBeDefined();
    expect(clement?.supportedActionTypes).toContain('Pelliculage');
  });

  it('time formats are valid HH:MM', () => {
    const providers = generateProviders();
    for (const provider of providers) {
      expect(provider.latestDepartureTime).toMatch(/^\d{2}:\d{2}$/);
      expect(provider.receptionTime).toMatch(/^\d{2}:\d{2}$/);
    }
  });
});

describe('generateAllStationData', () => {
  it('returns all station data combined', () => {
    const data = generateAllStationData();
    expect(data).toHaveProperty('categories');
    expect(data).toHaveProperty('groups');
    expect(data).toHaveProperty('stations');
    expect(data).toHaveProperty('providers');
  });

  it('station categoryIds reference valid categories', () => {
    const data = generateAllStationData();
    const categoryIds = new Set(data.categories.map((c) => c.id));
    for (const station of data.stations) {
      expect(categoryIds.has(station.categoryId)).toBe(true);
    }
  });

  it('station groupIds reference valid groups', () => {
    const data = generateAllStationData();
    const groupIds = new Set(data.groups.map((g) => g.id));
    for (const station of data.stations) {
      expect(groupIds.has(station.groupId)).toBe(true);
    }
  });

  it('provider groupIds reference valid groups', () => {
    const data = generateAllStationData();
    const groupIds = new Set(data.groups.map((g) => g.id));
    for (const provider of data.providers) {
      expect(groupIds.has(provider.groupId)).toBe(true);
    }
  });
});
