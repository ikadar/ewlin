/**
 * CFI-A: Drying Time + Operating Hours
 *
 * Tests that the 4-hour physical drying time interacts correctly
 * with station operating hours.
 *
 * Scenarios: CFI-A01, CFI-A02, CFI-A03
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SchedulerAPI } from '../helpers/api.js';
import { ValidatorAPI } from '../helpers/validator.js';
import { Fixture } from '../helpers/fixture.js';
import { today, tomorrow, dayOffset } from '../helpers/dates.js';

describe('CFI-A: Drying Time + Operating Hours', () => {
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

  // ─── CFI-A01: Drying time spans past Ryobi closing ───────────────────
  // Job: L-00001, Cahier 1: Ryobi 524 (07:00-14:00) → B26 (06:00-19:00)
  // Ryobi task: 120min (setup 15 + run 105)
  describe('CFI-A01: Drying time spans past Ryobi closing', () => {
    it('Cahier 1 Ryobi at 12:00 → ends at 14:00 (120min, exactly at Ryobi closing)', async () => {
      const task = await fix.task('L-00001', 'Cahier 1', 'Ryobi 524');
      expect(task.totalMinutes).toBe(120);

      const result = await api.assignTask(task.id, task.stationId, today('12:00'));
      // 120min from 12:00 = 14:00 (Ryobi closes at 14:00, fits exactly)
      expect(result.scheduledEnd).toContain('T14:00:00');
    });

    it('B26 at 16:00 → PrecedenceConflict (before drying ends at 18:00)', async () => {
      const ryobi = await fix.task('L-00001', 'Cahier 1', 'Ryobi 524');
      await api.assignTask(ryobi.id, ryobi.stationId, today('12:00'));

      const b26 = await fix.task('L-00001', 'Cahier 1', 'B26');
      const snapshot = await api.getSnapshot();
      const result = await validator.validate(
        {
          taskId: b26.id,
          targetId: b26.stationId,
          isOutsourced: false,
          scheduledStart: today('16:00'),
          bypassPrecedence: false,
        },
        snapshot,
      );

      expect(result.valid).toBe(false);
      expect(result.conflicts.length).toBeGreaterThanOrEqual(1);
      expect(result.conflicts.some((c) => c.type === 'PrecedenceConflict')).toBe(true);
    });

    it('B26 at 18:00 → valid (after drying ends)', async () => {
      const ryobi = await fix.task('L-00001', 'Cahier 1', 'Ryobi 524');
      await api.assignTask(ryobi.id, ryobi.stationId, today('12:00'));

      const b26 = await fix.task('L-00001', 'Cahier 1', 'B26');
      const snapshot = await api.getSnapshot();
      const result = await validator.validate(
        {
          taskId: b26.id,
          targetId: b26.stationId,
          isOutsourced: false,
          scheduledStart: today('18:00'),
          bypassPrecedence: false,
        },
        snapshot,
      );

      expect(result.valid).toBe(true);
    });
  });

  // ─── CFI-A02: Drying time ends outside successor station hours ───────
  // Job: L-00001, Couverture: Komori G40 (00:00-23:59) → Polar 137 (07:00-14:00)
  // Komori task: 120min (setup 15 + run 105)
  describe('CFI-A02: Drying time ends outside successor station hours', () => {
    it('Komori at 20:00 → ends ~22:00, drying ends ~02:00 next day', async () => {
      const komori = await fix.task('L-00001', 'Couverture', 'Komori G40');
      expect(komori.totalMinutes).toBe(120);

      const result = await api.assignTask(komori.id, komori.stationId, today('20:00'));
      // Komori runs 00:00-23:59, so 20:00 + 120min = 22:00 same day
      expect(result.scheduledEnd).toContain('T22:00:00');
    });

    it('Polar at 02:00 next day → PrecedenceConflict (drying not finished + station closed)', async () => {
      const komori = await fix.task('L-00001', 'Couverture', 'Komori G40');
      await api.assignTask(komori.id, komori.stationId, today('20:00'));

      const polar = await fix.task('L-00001', 'Couverture', 'Polar 137');
      const snapshot = await api.getSnapshot();
      const result = await validator.validate(
        {
          taskId: polar.id,
          targetId: polar.stationId,
          isOutsourced: false,
          scheduledStart: tomorrow('02:00'),
          bypassPrecedence: false,
        },
        snapshot,
      );

      expect(result.valid).toBe(false);
    });

    it('Polar at 07:00 next day → valid (after drying ends at 02:00, snapped to station open)', async () => {
      const komori = await fix.task('L-00001', 'Couverture', 'Komori G40');
      await api.assignTask(komori.id, komori.stationId, today('20:00'));

      const polar = await fix.task('L-00001', 'Couverture', 'Polar 137');
      const snapshot = await api.getSnapshot();
      const result = await validator.validate(
        {
          taskId: polar.id,
          targetId: polar.stationId,
          isOutsourced: false,
          scheduledStart: tomorrow('07:00'),
          bypassPrecedence: false,
        },
        snapshot,
      );

      // Drying ends at 02:00 next day, Polar opens at 07:00 → 07:00 is after drying
      expect(result.valid).toBe(true);
    });
  });

  // ─── CFI-A03: Drying time with Ryobi task near closing (overnight spillover) ──
  // Job: L-00008, ELT: Ryobi 524 (07:00-14:00) → Polar 137 (07:00-14:00)
  // Ryobi task: 60min (setup 15 + run 45)
  describe('CFI-A03: Drying time with Ryobi task near closing (overnight spillover)', () => {
    it('Ryobi at 13:30 → 30min before close, 30min next day → ends 07:30 next day', async () => {
      const ryobi = await fix.task('L-00008', 'ELT', 'Ryobi 524');
      expect(ryobi.totalMinutes).toBe(60);

      const result = await api.assignTask(ryobi.id, ryobi.stationId, today('13:30'));
      // 30min fits before 14:00 close, remaining 30min resumes 07:00 next day → ends 07:30
      expect(result.scheduledEnd).toContain('T07:30:00');
    });

    it('Polar at 08:00 next day → PrecedenceConflict (drying ends 11:30)', async () => {
      const ryobi = await fix.task('L-00008', 'ELT', 'Ryobi 524');
      await api.assignTask(ryobi.id, ryobi.stationId, today('13:30'));

      const polar = await fix.task('L-00008', 'ELT', 'Polar 137');
      const snapshot = await api.getSnapshot();
      const result = await validator.validate(
        {
          taskId: polar.id,
          targetId: polar.stationId,
          isOutsourced: false,
          scheduledStart: tomorrow('08:00'),
          bypassPrecedence: false,
        },
        snapshot,
      );

      // Ryobi ends 07:30 next day + 4h drying = 11:30 next day
      // Placing Polar at 08:00 → before drying ends
      expect(result.valid).toBe(false);
      expect(result.conflicts.some((c) => c.type === 'PrecedenceConflict')).toBe(true);
    });

    it('Polar at 11:30 next day → valid (exactly at drying end)', async () => {
      const ryobi = await fix.task('L-00008', 'ELT', 'Ryobi 524');
      await api.assignTask(ryobi.id, ryobi.stationId, today('13:30'));

      const polar = await fix.task('L-00008', 'ELT', 'Polar 137');
      const snapshot = await api.getSnapshot();
      const result = await validator.validate(
        {
          taskId: polar.id,
          targetId: polar.stationId,
          isOutsourced: false,
          scheduledStart: tomorrow('11:30'),
          bypassPrecedence: false,
        },
        snapshot,
      );

      expect(result.valid).toBe(true);
    });
  });
});
