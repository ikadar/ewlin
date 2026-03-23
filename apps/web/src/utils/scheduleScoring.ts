import type { ScheduleSnapshot, TaskAssignment } from '@flux/types';
import { COMPACT_HORIZONS } from '../constants';
import type { CompactHorizon } from '../constants';
import { compareSimilarity } from '../components/Tile/similarityUtils';

export interface SimilarityScore {
  printing: number;
  finishing: number;
  total: number;
}

export interface ScheduleScore {
  totalJobs: number;
  lateJobCount: number;
  onTimePercent: number;
  avgLatenessHours: number;
  maxLatenessHours: number;
  similarityByHorizon: Record<CompactHorizon, SimilarityScore>;
}

/**
 * Compute schedule evaluation scores from snapshot data.
 *
 * - Deadline metrics: derived from snapshot.lateJobs
 * - Similarity scores per horizon: count consecutive tile pairs sharing spec fields,
 *   split by printing (offset/digital) vs finishing (everything else),
 *   filtered to tiles within each time horizon from now
 */
export function computeScheduleScore(snapshot: ScheduleSnapshot): ScheduleScore {
  // ── Shared lookups (match SchedulingGrid's access pattern) ───────
  const taskMap = new Map(snapshot.tasks.map((t) => [t.id, t]));
  const elementMap = new Map(snapshot.elements.map((e) => [e.id, e]));

  // ── Deadline metrics ──────────────────────────────────────────────
  const scheduledJobIds = new Set<string>();

  for (const a of snapshot.assignments) {
    const task = taskMap.get(a.taskId);
    if (!task) continue;
    const element = elementMap.get(task.elementId);
    if (element) scheduledJobIds.add(element.jobId);
  }

  const totalJobs = scheduledJobIds.size;
  const lateJobs = snapshot.lateJobs.filter((lj) => scheduledJobIds.has(lj.jobId));
  const lateJobCount = lateJobs.length;
  const onTimePercent = totalJobs > 0 ? Math.round(((totalJobs - lateJobCount) / totalJobs) * 100) : 100;

  let avgLatenessHours = 0;
  let maxLatenessHours = 0;
  if (lateJobCount > 0) {
    const latenessHours = lateJobs.map((lj) => lj.delayDays * 24);
    avgLatenessHours = Math.round((latenessHours.reduce((a, b) => a + b, 0) / lateJobCount) * 10) / 10;
    maxLatenessHours = Math.max(...latenessHours);
  }

  // ── Similarity scoring (per horizon) ──────────────────────────────
  const stationMap = new Map(snapshot.stations.map((s) => [s.id, s]));
  const categoryMap = new Map(snapshot.categories.map((c) => [c.id, c]));

  // Identify printing station categories
  const printingCategoryIds = new Set<string>();
  for (const cat of snapshot.categories) {
    const name = cat.name.toLowerCase();
    if (name.includes('offset') || name.includes('numérique') || name.includes('digital')) {
      printingCategoryIds.add(cat.id);
    }
  }

  // Pre-filter non-outsourced assignments and parse dates once
  const internalAssignments = snapshot.assignments
    .filter((a) => !a.isOutsourced)
    .map((a) => ({ ...a, _startMs: new Date(a.scheduledStart).getTime() }));

  // Anchor horizon at earliest assignment, not wall-clock time
  const firstStart = internalAssignments.length > 0
    ? Math.min(...internalAssignments.map((a) => a._startMs))
    : Date.now();

  // Compute similarity for each horizon
  const similarityByHorizon = {} as Record<CompactHorizon, SimilarityScore>;

  for (const h of COMPACT_HORIZONS) {
    const horizonEnd = firstStart + h.hours * 3600_000;

    // Filter assignments starting within this horizon window
    const filtered = internalAssignments.filter(
      (a) => a._startMs <= horizonEnd,
    );

    // Group by station
    const byStation = new Map<string, (TaskAssignment & { _startMs: number })[]>();
    for (const a of filtered) {
      const list = byStation.get(a.targetId) || [];
      list.push(a);
      byStation.set(a.targetId, list);
    }

    let printing = 0;
    let finishing = 0;

    for (const [stationId, assignments] of byStation) {
      if (assignments.length < 2) continue;

      const station = stationMap.get(stationId);
      if (!station) continue;
      const category = categoryMap.get(station.categoryId);
      if (!category || category.similarityCriteria.length === 0) continue;

      const isPrinting = printingCategoryIds.has(station.categoryId);

      const sorted = [...assignments].sort((a, b) => a._startMs - b._startMs);

      let stationScore = 0;
      for (let i = 1; i < sorted.length; i++) {
        const taskA = taskMap.get(sorted[i - 1].taskId);
        const taskB = taskMap.get(sorted[i].taskId);
        if (!taskA || !taskB) continue;

        const elemA = elementMap.get(taskA.elementId);
        const elemB = elementMap.get(taskB.elementId);
        if (!elemA?.spec || !elemB?.spec) continue;

        const specA = elemA.spec;
        const specB = elemB.spec;

        const results = compareSimilarity(specA, specB, category.similarityCriteria);
        stationScore += results.filter((r) => r.isMatched).length;
      }

      if (isPrinting) {
        printing += stationScore;
      } else {
        finishing += stationScore;
      }
    }

    similarityByHorizon[h.hours] = { printing, finishing, total: printing + finishing };
  }

  return {
    totalJobs,
    lateJobCount,
    onTimePercent,
    avgLatenessHours,
    maxLatenessHours,
    similarityByHorizon,
  };
}
