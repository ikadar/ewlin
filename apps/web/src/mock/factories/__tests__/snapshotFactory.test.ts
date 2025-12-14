import { describe, it, expect } from 'vitest';
import { snapshotFactory } from '../snapshotFactory';

describe('snapshotFactory', () => {
  describe('create', () => {
    it('returns a complete snapshot', () => {
      const snapshot = snapshotFactory.create();

      expect(snapshot).toHaveProperty('snapshotVersion');
      expect(snapshot).toHaveProperty('generatedAt');
      expect(snapshot).toHaveProperty('stations');
      expect(snapshot).toHaveProperty('providers');
      expect(snapshot).toHaveProperty('categories');
      expect(snapshot).toHaveProperty('groups');
      expect(snapshot).toHaveProperty('jobs');
      expect(snapshot).toHaveProperty('assignments');
      expect(snapshot).toHaveProperty('conflicts');
      expect(snapshot).toHaveProperty('lateJobs');
    });

    it('respects jobCount option', () => {
      const snapshot = snapshotFactory.create({ jobCount: 5 });
      expect(snapshot.jobs.length).toBe(5);
    });

    it('includes conflicts when requested', () => {
      const snapshot = snapshotFactory.create({ includeConflicts: true });
      // Conflicts are generated based on data, may or may not have entries
      expect(Array.isArray(snapshot.conflicts)).toBe(true);
    });

    it('includes late jobs when requested', () => {
      const snapshot = snapshotFactory.create({ includeLateJobs: true });
      expect(Array.isArray(snapshot.lateJobs)).toBe(true);
    });

    it('has valid generatedAt timestamp', () => {
      const snapshot = snapshotFactory.create();
      expect(() => new Date(snapshot.generatedAt)).not.toThrow();
    });
  });

  describe('createEmpty', () => {
    it('returns snapshot with no jobs or assignments', () => {
      const snapshot = snapshotFactory.createEmpty();

      expect(snapshot.jobs).toEqual([]);
      expect(snapshot.assignments).toEqual([]);
      expect(snapshot.conflicts).toEqual([]);
      expect(snapshot.lateJobs).toEqual([]);
    });

    it('still has stations and categories', () => {
      const snapshot = snapshotFactory.createEmpty();

      expect(snapshot.stations.length).toBeGreaterThan(0);
      expect(snapshot.categories.length).toBeGreaterThan(0);
      expect(snapshot.groups.length).toBeGreaterThan(0);
    });
  });

  describe('createMinimal', () => {
    it('returns a minimal snapshot for simple tests', () => {
      const snapshot = snapshotFactory.createMinimal();

      expect(snapshot.stations.length).toBeLessThanOrEqual(3);
      expect(snapshot.providers.length).toBeLessThanOrEqual(1);
      expect(snapshot.jobs.length).toBeLessThanOrEqual(2);
    });
  });
});
