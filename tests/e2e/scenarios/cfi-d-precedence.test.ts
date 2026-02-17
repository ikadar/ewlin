/**
 * CFI-D: Precedence + Operating Hours
 *
 * Tests that predecessor end times correctly account for station
 * operating hours when computing precedence constraints.
 *
 * Scenarios: CFI-D01, CFI-D02, CFI-D03
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SchedulerAPI } from '../helpers/api.js';
import { ValidatorAPI } from '../helpers/validator.js';
import { Fixture } from '../helpers/fixture.js';
import { today, tomorrow } from '../helpers/dates.js';

describe('CFI-D: Precedence + Operating Hours', () => {
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

  // ─── CFI-D01: Cross-element predecessor constraint ───────────────────
  // Job: L-00001, Finition depends on Couverture, Cahier 1, Cahier 2
  // Finition Hohner can only start after ALL 3 elements' last tasks are done
  describe('CFI-D01: Cross-element predecessor constraint', () => {
    it('Hohner before all predecessors done → PrecedenceConflict', async () => {
      // Schedule all 6 print tasks for Couv, Cah1, Cah2
      const komoTask = await fix.task('L-00001', 'Couverture', 'Komori G40');
      await api.assignTask(komoTask.id, komoTask.stationId, today('07:00'));

      const polarCouv = await fix.task('L-00001', 'Couverture', 'Polar 137');
      await api.assignTask(polarCouv.id, polarCouv.stationId, tomorrow('07:00'), true);

      const ryobiCah1 = await fix.task('L-00001', 'Cahier 1', 'Ryobi 524');
      await api.assignTask(ryobiCah1.id, ryobiCah1.stationId, today('07:00'));

      const b26 = await fix.task('L-00001', 'Cahier 1', 'B26');
      await api.assignTask(b26.id, b26.stationId, tomorrow('06:00'), true);

      const sm52 = await fix.task('L-00001', 'Cahier 2', 'Heidelberg SM52');
      await api.assignTask(sm52.id, sm52.stationId, today('07:00'));

      const mboS = await fix.task('L-00001', 'Cahier 2', 'MBO S');
      await api.assignTask(mboS.id, mboS.stationId, tomorrow('06:00'), true);

      // Hohner at 07:00 today → WAY before predecessors finish
      const hohner = await fix.task('L-00001', 'Finition', 'Hohner');
      const snapshot = await api.getSnapshot();
      const result = await validator.validate(
        {
          taskId: hohner.id,
          targetId: hohner.stationId,
          isOutsourced: false,
          scheduledStart: today('07:00'),
          bypassPrecedence: false,
        },
        snapshot,
      );

      expect(result.valid).toBe(false);
      expect(result.conflicts.some((c) => c.type === 'PrecedenceConflict')).toBe(true);
    });

    it('Hohner after all predecessors → valid', async () => {
      // Schedule all 6 tasks early
      const komoTask = await fix.task('L-00001', 'Couverture', 'Komori G40');
      await api.assignTask(komoTask.id, komoTask.stationId, today('07:00'));

      const polarCouv = await fix.task('L-00001', 'Couverture', 'Polar 137');
      await api.assignTask(polarCouv.id, polarCouv.stationId, tomorrow('07:00'), true);

      const ryobiCah1 = await fix.task('L-00001', 'Cahier 1', 'Ryobi 524');
      await api.assignTask(ryobiCah1.id, ryobiCah1.stationId, today('07:00'));

      const b26 = await fix.task('L-00001', 'Cahier 1', 'B26');
      const b26Result = await api.assignTask(b26.id, b26.stationId, tomorrow('06:00'), true);

      const sm52 = await fix.task('L-00001', 'Cahier 2', 'Heidelberg SM52');
      await api.assignTask(sm52.id, sm52.stationId, today('07:00'));

      const mboS = await fix.task('L-00001', 'Cahier 2', 'MBO S');
      const mbosResult = await api.assignTask(mboS.id, mboS.stationId, tomorrow('06:00'), true);

      // Get latest predecessor end + find what time Hohner can start
      const snapshot = await api.getSnapshot();
      const hohner = await fix.task('L-00001', 'Finition', 'Hohner');

      // Try placing Hohner far in the future (should be valid after all predecessors)
      const result = await validator.validate(
        {
          taskId: hohner.id,
          targetId: hohner.stationId,
          isOutsourced: false,
          scheduledStart: tomorrow('18:00'),
          bypassPrecedence: false,
        },
        snapshot,
      );

      expect(result.valid).toBe(true);
    });
  });

  // ─── CFI-D02: Narrow-schedule station — actual vs naive end time ──────
  // Job: L-00003, Intérieur: Ryobi 524 (07:00-14:00) → Polar 137
  // Ryobi task: 75min (setup 15 + run 60)
  describe('CFI-D02: Narrow-schedule station — actual vs naive end time', () => {
    it('Ryobi at 13:00, 75min task → spans overnight → ends 07:15 next day', async () => {
      const ryobi = await fix.task('L-00003', 'Intérieur', 'Ryobi 524');
      expect(ryobi.totalMinutes).toBe(75);

      const result = await api.assignTask(ryobi.id, ryobi.stationId, today('13:00'));
      // 60min fits 13:00-14:00, remaining 15min: 07:00-07:15 next day
      expect(result.scheduledEnd).toContain('T07:15:00');
    });

    it('Polar at 07:30 next day → PrecedenceConflict (drying ends 11:15)', async () => {
      const ryobi = await fix.task('L-00003', 'Intérieur', 'Ryobi 524');
      await api.assignTask(ryobi.id, ryobi.stationId, today('13:00'));

      const polar = await fix.task('L-00003', 'Intérieur', 'Polar 137');
      const snapshot = await api.getSnapshot();
      const result = await validator.validate(
        {
          taskId: polar.id,
          targetId: polar.stationId,
          isOutsourced: false,
          scheduledStart: tomorrow('07:30'),
          bypassPrecedence: false,
        },
        snapshot,
      );

      // Ryobi ends 07:15 next day + 4h drying = 11:15 next day
      expect(result.valid).toBe(false);
      expect(result.conflicts.some((c) => c.type === 'PrecedenceConflict')).toBe(true);
    });

    it('Polar at 11:15 next day → valid (drying finished)', async () => {
      const ryobi = await fix.task('L-00003', 'Intérieur', 'Ryobi 524');
      await api.assignTask(ryobi.id, ryobi.stationId, today('13:00'));

      const polar = await fix.task('L-00003', 'Intérieur', 'Polar 137');
      const snapshot = await api.getSnapshot();
      const result = await validator.validate(
        {
          taskId: polar.id,
          targetId: polar.stationId,
          isOutsourced: false,
          scheduledStart: tomorrow('11:15'),
          bypassPrecedence: false,
        },
        snapshot,
      );

      expect(result.valid).toBe(true);
    });
  });

  // ─── CFI-D03: Assembleuse narrow hours + cross-element ────────────────
  // Job: L-00003, Assemblage: Horizon ASS (06:00-13:00) → Filmeuse (07:00-14:00)
  // Horizon ASS task: 150min (setup 45 + run 105)
  describe('CFI-D03: Assembleuse narrow hours + cross-element', () => {
    it('Horizon ASS at 12:00 → spans overnight (closes 13:00)', async () => {
      // First schedule predecessors so we can assign Assemblage tasks
      const ryobiInt = await fix.task('L-00003', 'Intérieur', 'Ryobi 524');
      await api.assignTask(ryobiInt.id, ryobiInt.stationId, today('07:00'));
      const polarInt = await fix.task('L-00003', 'Intérieur', 'Polar 137');
      await api.assignTask(polarInt.id, polarInt.stationId, tomorrow('07:00'), true);

      const sm52Couv = await fix.task('L-00003', 'Couverture', 'Heidelberg SM52');
      await api.assignTask(sm52Couv.id, sm52Couv.stationId, today('07:00'));
      const polarCouv = await fix.task('L-00003', 'Couverture', 'Polar 137');
      await api.assignTask(polarCouv.id, polarCouv.stationId, tomorrow('07:30'), true);

      const horizonASS = await fix.task('L-00003', 'Assemblage', 'Horizon ASS');
      expect(horizonASS.totalMinutes).toBe(150);

      // Place at 12:00 — station closes 13:00 → 60min fits, 90min remains
      const result = await api.assignTask(
        horizonASS.id,
        horizonASS.stationId,
        tomorrow('12:00'),
        true,
      );

      // 60min: 12:00-13:00, then 90min: 06:00-07:30 next day
      // scheduledEnd should be on the day after tomorrow
      const endDate = new Date(result.scheduledEnd);
      expect(endDate.getHours()).toBe(7);
      expect(endDate.getMinutes()).toBe(30);
    });

    it('Filmeuse before Horizon ASS ends → PrecedenceConflict', async () => {
      // Schedule predecessors
      const ryobiInt = await fix.task('L-00003', 'Intérieur', 'Ryobi 524');
      await api.assignTask(ryobiInt.id, ryobiInt.stationId, today('07:00'));
      const polarInt = await fix.task('L-00003', 'Intérieur', 'Polar 137');
      await api.assignTask(polarInt.id, polarInt.stationId, tomorrow('07:00'), true);
      const sm52Couv = await fix.task('L-00003', 'Couverture', 'Heidelberg SM52');
      await api.assignTask(sm52Couv.id, sm52Couv.stationId, today('07:00'));
      const polarCouv = await fix.task('L-00003', 'Couverture', 'Polar 137');
      await api.assignTask(polarCouv.id, polarCouv.stationId, tomorrow('07:30'), true);

      const horizonASS = await fix.task('L-00003', 'Assemblage', 'Horizon ASS');
      await api.assignTask(horizonASS.id, horizonASS.stationId, tomorrow('12:00'), true);

      const filmeuse = await fix.task('L-00003', 'Assemblage', 'Filmeuse');
      const snapshot = await api.getSnapshot();
      const result = await validator.validate(
        {
          taskId: filmeuse.id,
          targetId: filmeuse.stationId,
          isOutsourced: false,
          scheduledStart: tomorrow('07:00'),
          bypassPrecedence: false,
        },
        snapshot,
      );

      expect(result.valid).toBe(false);
      expect(result.conflicts.some((c) => c.type === 'PrecedenceConflict')).toBe(true);
    });
  });
});
