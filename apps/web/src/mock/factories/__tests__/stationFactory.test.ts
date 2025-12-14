import { describe, it, expect } from 'vitest';
import {
  stationFactory,
  categoryFactory,
  groupFactory,
  providerFactory,
} from '../stationFactory';

describe('stationFactory', () => {
  describe('createMany', () => {
    it('returns an array of stations', () => {
      const stations = stationFactory.createMany();
      expect(Array.isArray(stations)).toBe(true);
      expect(stations.length).toBeGreaterThan(0);
    });

    it('each station has required fields', () => {
      const stations = stationFactory.createMany();
      for (const station of stations) {
        expect(station).toHaveProperty('id');
        expect(station).toHaveProperty('name');
        expect(station).toHaveProperty('categoryId');
        expect(station).toHaveProperty('capacity');
        expect(station).toHaveProperty('status');
        expect(station).toHaveProperty('operatingSchedule');
      }
    });
  });

  describe('findById', () => {
    it('returns station when found', () => {
      const stations = stationFactory.createMany();
      const station = stationFactory.findById(stations[0].id);
      expect(station).toBeDefined();
      expect(station?.id).toBe(stations[0].id);
    });

    it('returns undefined when not found', () => {
      const station = stationFactory.findById('non-existent-id');
      expect(station).toBeUndefined();
    });
  });

  describe('findByCategory', () => {
    it('returns stations matching category', () => {
      const stations = stationFactory.findByCategory('cat-offset');
      expect(stations.length).toBeGreaterThan(0);
      expect(stations.every((s) => s.categoryId === 'cat-offset')).toBe(true);
    });
  });

  describe('findByGroup', () => {
    it('returns stations matching group', () => {
      const stations = stationFactory.findByGroup('grp-offset');
      expect(stations.length).toBeGreaterThan(0);
      expect(stations.every((s) => s.groupId === 'grp-offset')).toBe(true);
    });
  });
});

describe('categoryFactory', () => {
  describe('createMany', () => {
    it('returns an array of categories', () => {
      const categories = categoryFactory.createMany();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
    });

    it('each category has required fields', () => {
      const categories = categoryFactory.createMany();
      for (const category of categories) {
        expect(category).toHaveProperty('id');
        expect(category).toHaveProperty('name');
        expect(category).toHaveProperty('similarityCriteria');
      }
    });
  });

  describe('findById', () => {
    it('returns category when found', () => {
      const category = categoryFactory.findById('cat-offset');
      expect(category).toBeDefined();
      expect(category?.name).toBe('Offset Printing Press');
    });
  });
});

describe('groupFactory', () => {
  describe('createStationGroups', () => {
    it('returns station groups', () => {
      const groups = groupFactory.createStationGroups();
      expect(groups.length).toBeGreaterThan(0);
      expect(groups.every((g) => g.isOutsourcedProviderGroup === false)).toBe(
        true
      );
    });
  });

  describe('createProviderGroups', () => {
    it('returns provider groups', () => {
      const groups = groupFactory.createProviderGroups();
      expect(groups.length).toBeGreaterThan(0);
      expect(groups.every((g) => g.isOutsourcedProviderGroup === true)).toBe(
        true
      );
    });
  });

  describe('createAll', () => {
    it('returns both station and provider groups', () => {
      const allGroups = groupFactory.createAll();
      const stationGroups = groupFactory.createStationGroups();
      const providerGroups = groupFactory.createProviderGroups();
      expect(allGroups.length).toBe(
        stationGroups.length + providerGroups.length
      );
    });
  });
});

describe('providerFactory', () => {
  describe('createMany', () => {
    it('returns an array of providers', () => {
      const providers = providerFactory.createMany();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });

    it('each provider has required fields', () => {
      const providers = providerFactory.createMany();
      for (const provider of providers) {
        expect(provider).toHaveProperty('id');
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('supportedActionTypes');
        expect(provider).toHaveProperty('latestDepartureTime');
        expect(provider).toHaveProperty('status');
      }
    });
  });

  describe('findByActionType', () => {
    it('returns providers supporting the action type', () => {
      const providers = providerFactory.findByActionType('Pelliculage');
      expect(providers.length).toBeGreaterThan(0);
      expect(
        providers.every((p) => p.supportedActionTypes.includes('Pelliculage'))
      ).toBe(true);
    });
  });
});
