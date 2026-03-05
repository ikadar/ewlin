/**
 * CFI-F: Multi-Job Station Conflicts
 *
 * Tests that station conflicts are correctly detected when multiple
 * jobs compete for the same station at the same time.
 *
 * Scenarios: CFI-F01, CFI-F02, CFI-F03
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SchedulerAPI } from '../helpers/api.js';
import { ValidatorAPI } from '../helpers/validator.js';
import { Fixture } from '../helpers/fixture.js';
import { today, tomorrow } from '../helpers/dates.js';

describe('CFI-F: Multi-Job Station Conflicts', () => {
  const api = new SchedulerAPI();
  const validator = new ValidatorAPI();
  const fix = new Fixture(api);

  beforeAll(async () => {
    await api.healthCheck();
    await validator.healthCheck();
  });

  beforeEach(async () => {
    await api.recallAll();
    fix.invalidate();
  });

  // ─── CFI-F01: Two jobs competing for same station slot ───────────────
  // L-00001 Cahier 1 Ryobi + L-00003 Intérieur Ryobi → same Ryobi 524 at 08:00
  describe('CFI-F01: Two jobs competing for same station slot', () => {
    it('Second job at same time on Ryobi → StationConflict', async () => {
      // L-00001 Cahier 1 on Ryobi 524 at 08:00
      const task1 = await fix.task('L-00001', 'Cahier 1', 'Ryobi 524');
      await api.assignTask(task1.id, task1.stationId, today('08:00'));

      // L-00003 Intérieur on Ryobi 524 at 08:00 (same time, same station)
      const task2 = await fix.task('L-00003', 'Intérieur', 'Ryobi 524');
      const snapshot = await api.getSnapshot();
      const result = await validator.validate(
        {
          taskId: task2.id,
          targetId: task2.stationId,
          isOutsourced: false,
          scheduledStart: today('08:00'),
          bypassPrecedence: false,
        },
        snapshot,
      );

      expect(result.valid).toBe(false);
      expect(result.conflicts.some((c) => c.type === 'StationConflict')).toBe(true);
    });

    it('Second job at non-overlapping time → valid', async () => {
      // L-00001 Cahier 1 on Ryobi 524 at 08:00 (120min → ends 10:00)
      const task1 = await fix.task('L-00001', 'Cahier 1', 'Ryobi 524');
      await api.assignTask(task1.id, task1.stationId, today('08:00'));

      // L-00003 Intérieur on Ryobi 524 at 10:00 (after task1 ends)
      const task2 = await fix.task('L-00003', 'Intérieur', 'Ryobi 524');
      const snapshot = await api.getSnapshot();
      const result = await validator.validate(
        {
          taskId: task2.id,
          targetId: task2.stationId,
          isOutsourced: false,
          scheduledStart: today('10:00'),
          bypassPrecedence: false,
        },
        snapshot,
      );

      expect(result.valid).toBe(true);
    });
  });

  // ─── CFI-F02: Two jobs on same station, sequential (no conflict) ─────
  // L-00001 Cahier 1 Ryobi at 07:00 (120min → 09:00) then L-00003 Intérieur at 09:00
  describe('CFI-F02: Two jobs on same station, sequential', () => {
    it('Sequential tasks on Ryobi → no conflict', async () => {
      // L-00001 Cahier 1 at 07:00 (120min → ends 09:00)
      const task1 = await fix.task('L-00001', 'Cahier 1', 'Ryobi 524');
      const result1 = await api.assignTask(task1.id, task1.stationId, today('07:00'));
      expect(result1.scheduledEnd).toContain('T09:00:00');

      // L-00003 Intérieur at 09:00 (right after task1 ends)
      const task2 = await fix.task('L-00003', 'Intérieur', 'Ryobi 524');
      const result2 = await api.assignTask(task2.id, task2.stationId, today('09:00'));

      // Should succeed — no overlap
      expect(result2.taskId).toBe(task2.id);
    });
  });

  // ─── CFI-F03: Polar 137 bottleneck — multiple jobs ───────────────────
  // All jobs with massicot step use Polar 137 (only 1 massicot station)
  describe('CFI-F03: Polar 137 bottleneck — 3 jobs', () => {
    it('First Polar task → valid, second at same time → conflict', async () => {
      // L-00001 Couverture Polar at 08:00
      const polar1 = await fix.task('L-00001', 'Couverture', 'Komori G40');
      await api.assignTask(polar1.id, polar1.stationId, today('07:00'));

      const polarTask1 = await fix.task('L-00001', 'Couverture', 'Polar 137');
      // Assign first Polar task (needs predecessor, bypass precedence)
      await api.assignTask(polarTask1.id, polarTask1.stationId, tomorrow('08:00'), true);

      // L-00008 ELT Polar at 08:00 (same time)
      const ryobi8 = await fix.task('L-00008', 'ELT', 'Ryobi 524');
      await api.assignTask(ryobi8.id, ryobi8.stationId, today('07:00'));

      const polarTask2 = await fix.task('L-00008', 'ELT', 'Polar 137');
      const snapshot = await api.getSnapshot();
      const result = await validator.validate(
        {
          taskId: polarTask2.id,
          targetId: polarTask2.stationId,
          isOutsourced: false,
          scheduledStart: tomorrow('08:00'),
          bypassPrecedence: true,
        },
        snapshot,
      );

      expect(result.valid).toBe(false);
      expect(result.conflicts.some((c) => c.type === 'StationConflict')).toBe(true);
    });

    it('Polar tasks stacked sequentially → all valid', async () => {
      // First: L-00001 Couverture Polar at 08:00 (30min → 08:30)
      const polar1 = await fix.task('L-00001', 'Couverture', 'Polar 137');
      const result1 = await api.assignTask(
        polar1.id,
        polar1.stationId,
        tomorrow('08:00'),
        true,
      );

      // Second: L-00008 ELT Polar at 08:30 (30min → 09:00)
      const polar2 = await fix.task('L-00008', 'ELT', 'Polar 137');
      const snapshot = await api.getSnapshot();
      const result = await validator.validate(
        {
          taskId: polar2.id,
          targetId: polar2.stationId,
          isOutsourced: false,
          scheduledStart: tomorrow('08:30'),
          bypassPrecedence: true,
        },
        snapshot,
      );

      expect(result.valid).toBe(true);
    });
  });
});
