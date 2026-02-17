/**
 * CFI-G: Recall Cascade Scenarios
 *
 * Tests recall behavior: recalling a middle task in a chain, and the
 * full recall + outsourced cascade + re-schedule cycle.
 *
 * Scenarios: CFI-G01, CFI-G02
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SchedulerAPI } from '../helpers/api.js';
import { ValidatorAPI } from '../helpers/validator.js';
import { Fixture } from '../helpers/fixture.js';
import { today, tomorrow, dayOffset } from '../helpers/dates.js';

describe('CFI-G: Recall Cascade Scenarios', () => {
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

  // ─── CFI-G01: Recall middle task in same-element chain ───────────────
  // Job: L-00008, ELT: Ryobi → Polar → MBO S → Carton
  describe('CFI-G01: Recall middle task in same-element chain', () => {
    it('Recall Polar (2nd) → MBO S and Carton remain scheduled', async () => {
      // Schedule all 4 tasks
      const ryobi = await fix.task('L-00008', 'ELT', 'Ryobi 524');
      await api.assignTask(ryobi.id, ryobi.stationId, today('07:00'));

      const polar = await fix.task('L-00008', 'ELT', 'Polar 137');
      await api.assignTask(polar.id, polar.stationId, tomorrow('07:00'), true);

      const mboS = await fix.task('L-00008', 'ELT', 'MBO S');
      await api.assignTask(mboS.id, mboS.stationId, tomorrow('08:00'), true);

      const carton = await fix.task('L-00008', 'ELT', 'Carton');
      await api.assignTask(carton.id, carton.stationId, tomorrow('12:00'), true);

      // Verify all 4 are assigned
      fix.invalidate();
      let snapshot = await api.getSnapshot();
      expect(snapshot.assignments.length).toBeGreaterThanOrEqual(4);

      // Recall Polar (2nd in chain)
      await api.recallTask(polar.id);

      // Check: MBO S and Carton should remain scheduled
      snapshot = await api.getSnapshot();
      const mboAssignment = snapshot.assignments.find((a) => a.taskId === mboS.id);
      const cartonAssignment = snapshot.assignments.find((a) => a.taskId === carton.id);
      const polarAssignment = snapshot.assignments.find((a) => a.taskId === polar.id);

      expect(polarAssignment).toBeUndefined(); // Polar recalled
      expect(mboAssignment).toBeDefined(); // MBO S remains
      expect(cartonAssignment).toBeDefined(); // Carton remains
    });
  });

  // ─── CFI-G02: Recall + outsourced cascade + re-schedule ──────────────
  // Job: L-00010 (with Clément outsourced)
  describe('CFI-G02: Recall + outsourced cascade + re-schedule full cycle', () => {
    /** Helper: schedule all 6 internal tasks for L-00010 */
    async function scheduleAll() {
      const ryobiCouv = await fix.task('L-00010', 'Couverture', 'Ryobi 524');
      await api.assignTask(ryobiCouv.id, ryobiCouv.stationId, today('07:00'));
      const polarCouv = await fix.task('L-00010', 'Couverture', 'Polar 137');
      await api.assignTask(polarCouv.id, polarCouv.stationId, tomorrow('07:00'), true);

      const sm52 = await fix.task('L-00010', 'Cahier 1', 'Heidelberg SM52');
      await api.assignTask(sm52.id, sm52.stationId, today('07:00'));
      const mboM80 = await fix.task('L-00010', 'Cahier 1', 'MBO M80');
      await api.assignTask(mboM80.id, mboM80.stationId, tomorrow('06:00'), true);

      const komori = await fix.task('L-00010', 'Cahier 2', 'Komori G40');
      await api.assignTask(komori.id, komori.stationId, today('07:00'));
      const b26 = await fix.task('L-00010', 'Cahier 2', 'B26');
      await api.assignTask(b26.id, b26.stationId, tomorrow('06:00'), true);

      return { ryobiCouv, polarCouv, sm52, mboM80, komori, b26 };
    }

    it('Full cycle: assigned → recall → removed → re-schedule → re-assigned', async () => {
      const tasks = await scheduleAll();
      const outsourced = await fix.outsourcedTask('L-00010', 'Finition');

      // Step 1: Verify outsourced is assigned after all 6 tasks
      fix.invalidate();
      let snapshot = await api.getSnapshot();
      let outAssignment = snapshot.assignments.find((a) => a.taskId === outsourced.id);
      expect(outAssignment).toBeDefined();

      // Step 2: Recall Cahier 1 MBO M80
      await api.recallTask(tasks.mboM80.id);

      // Step 3: Outsourced should be removed
      snapshot = await api.getSnapshot();
      outAssignment = snapshot.assignments.find((a) => a.taskId === outsourced.id);
      expect(outAssignment).toBeUndefined();

      // Step 4: Also recall SM52 (first task of Cahier 1)
      await api.recallTask(tasks.sm52.id);
      snapshot = await api.getSnapshot();
      outAssignment = snapshot.assignments.find((a) => a.taskId === outsourced.id);
      expect(outAssignment).toBeUndefined();

      // Step 5: Re-schedule SM52 at a different time
      await api.assignTask(tasks.sm52.id, tasks.sm52.stationId, dayOffset(2, '07:00'));

      // Step 6: Re-schedule MBO M80 (same day as SM52, later — avoids weekend)
      await api.assignTask(
        tasks.mboM80.id,
        tasks.mboM80.stationId,
        dayOffset(2, '12:00'),
        true,
      );

      // Step 7: Outsourced should re-assign with new dates
      snapshot = await api.getSnapshot();
      outAssignment = snapshot.assignments.find((a) => a.taskId === outsourced.id);
      expect(outAssignment).toBeDefined();
      expect(outAssignment!.isOutsourced).toBe(true);
    });
  });
});
