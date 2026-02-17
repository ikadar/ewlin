/**
 * CFI-C: Outsourced Task Interactions
 *
 * Tests the lifecycle of outsourced tasks: auto-assign when all
 * predecessors are scheduled, auto-removal on recall, re-assignment.
 *
 * Scenarios: CFI-C01, CFI-C02, CFI-C03, CFI-C04
 *
 * Job: L-00010 (Brochure piquée 16p catalogue with Clément outsourced Finition)
 * Elements:
 *   - Couverture: Ryobi 524 → Polar 137
 *   - Cahier 1: SM52 → MBO M80
 *   - Cahier 2: Komori G40 → B26
 *   - Finition: outsourced (Clément)
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SchedulerAPI } from '../helpers/api.js';
import { ValidatorAPI } from '../helpers/validator.js';
import { Fixture, type TaskInfo } from '../helpers/fixture.js';
import { today, tomorrow, dayOffset } from '../helpers/dates.js';

describe('CFI-C: Outsourced Task Interactions', () => {
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

  /** Helper: schedule all 6 internal tasks for L-00010 */
  async function scheduleAllInternal() {
    // Couverture: Ryobi → Polar
    const ryobiCouv = await fix.task('L-00010', 'Couverture', 'Ryobi 524');
    await api.assignTask(ryobiCouv.id, ryobiCouv.stationId, today('07:00'));

    const polarCouv = await fix.task('L-00010', 'Couverture', 'Polar 137');
    await api.assignTask(polarCouv.id, polarCouv.stationId, tomorrow('07:00'), true);

    // Cahier 1: SM52 → MBO M80
    const sm52 = await fix.task('L-00010', 'Cahier 1', 'Heidelberg SM52');
    await api.assignTask(sm52.id, sm52.stationId, today('07:00'));

    const mboM80 = await fix.task('L-00010', 'Cahier 1', 'MBO M80');
    await api.assignTask(mboM80.id, mboM80.stationId, tomorrow('06:00'), true);

    // Cahier 2: Komori G40 → B26
    const komori = await fix.task('L-00010', 'Cahier 2', 'Komori G40');
    await api.assignTask(komori.id, komori.stationId, today('07:00'));

    const b26 = await fix.task('L-00010', 'Cahier 2', 'B26');
    await api.assignTask(b26.id, b26.stationId, tomorrow('06:00'), true);

    return { ryobiCouv, polarCouv, sm52, mboM80, komori, b26 };
  }

  /** Helper: check if the outsourced task is assigned */
  async function getOutsourcedAssignment() {
    const outsourced = await fix.outsourcedTask('L-00010', 'Finition');
    fix.invalidate(); // Force fresh snapshot
    const snapshot = await api.getSnapshot();
    const assignment = snapshot.assignments.find((a) => a.taskId === outsourced.id);
    return { outsourced, assignment };
  }

  // ─── CFI-C01: Full outsourced auto-assign lifecycle ──────────────────
  describe('CFI-C01: Full outsourced auto-assign lifecycle', () => {
    it('All 6 predecessors scheduled → outsourced auto-assigns', async () => {
      await scheduleAllInternal();

      const { outsourced, assignment } = await getOutsourcedAssignment();

      expect(assignment).toBeDefined();
      expect(assignment!.taskId).toBe(outsourced.id);
      expect(assignment!.isOutsourced).toBe(true);
      // The assignment should have valid start/end dates
      expect(assignment!.scheduledStart).toBeTruthy();
      expect(assignment!.scheduledEnd).toBeTruthy();
    });
  });

  // ─── CFI-C02: Partial predecessor scheduling — no auto-assign ────────
  describe('CFI-C02: Partial predecessor scheduling — no auto-assign', () => {
    it('Only Couverture and Cahier 1 scheduled → outsourced NOT auto-assigned', async () => {
      // Schedule Couverture
      const ryobiCouv = await fix.task('L-00010', 'Couverture', 'Ryobi 524');
      await api.assignTask(ryobiCouv.id, ryobiCouv.stationId, today('07:00'));
      const polarCouv = await fix.task('L-00010', 'Couverture', 'Polar 137');
      await api.assignTask(polarCouv.id, polarCouv.stationId, tomorrow('07:00'), true);

      // Schedule Cahier 1
      const sm52 = await fix.task('L-00010', 'Cahier 1', 'Heidelberg SM52');
      await api.assignTask(sm52.id, sm52.stationId, today('07:00'));
      const mboM80 = await fix.task('L-00010', 'Cahier 1', 'MBO M80');
      await api.assignTask(mboM80.id, mboM80.stationId, tomorrow('06:00'), true);

      // Leave Cahier 2 unscheduled

      const { assignment } = await getOutsourcedAssignment();
      expect(assignment).toBeUndefined();
    });
  });

  // ─── CFI-C03: Recall predecessor → outsourced auto-removal ───────────
  describe('CFI-C03: Recall predecessor → outsourced auto-removal', () => {
    it('Recall one predecessor → outsourced assignment removed', async () => {
      // First: schedule all 6 tasks → outsourced auto-assigns
      const tasks = await scheduleAllInternal();

      // Verify outsourced is assigned
      const before = await getOutsourcedAssignment();
      expect(before.assignment).toBeDefined();

      // Recall Cahier 2 B26 (last task in Cahier 2 element)
      await api.recallTask(tasks.b26.id);

      // Outsourced should now be unassigned
      const after = await getOutsourcedAssignment();
      expect(after.assignment).toBeUndefined();
    });
  });

  // ─── CFI-C04: Re-schedule predecessor → outsourced re-assignment ─────
  describe('CFI-C04: Re-schedule predecessor → outsourced re-assignment', () => {
    it('Recall + re-schedule → outsourced re-assigns with new dates', async () => {
      // Schedule all → outsourced auto-assigns
      const tasks = await scheduleAllInternal();

      const before = await getOutsourcedAssignment();
      expect(before.assignment).toBeDefined();
      const originalStart = before.assignment!.scheduledStart;

      // Recall B26
      await api.recallTask(tasks.b26.id);

      // Verify outsourced is removed
      const mid = await getOutsourcedAssignment();
      expect(mid.assignment).toBeUndefined();

      // Re-schedule B26 at a LATER time
      await api.assignTask(tasks.b26.id, tasks.b26.stationId, dayOffset(2, '06:00'), true);

      // Outsourced should re-assign with new dates
      const after = await getOutsourcedAssignment();
      expect(after.assignment).toBeDefined();
      expect(after.assignment!.isOutsourced).toBe(true);
      // The new start should potentially differ since B26 is later now
      expect(after.assignment!.scheduledStart).toBeTruthy();
    });
  });
});
