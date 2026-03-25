#!/usr/bin/env node --experimental-strip-types
/**
 * Schedule snapshot analysis tool.
 *
 * Usage:
 *   node --experimental-strip-types tools/analyze_snapshots.ts <snapshot.json>
 *   node --experimental-strip-types tools/analyze_snapshots.ts <before.json> <after.json>
 *
 * Single snapshot: unplaced task analysis + conflict checks.
 * Two snapshots:   diff (changed assignments) + unplaced + conflicts + on-time/late.
 */

import { readFileSync } from 'fs';

// ─── Types ───

interface Station {
  id: string; name: string; categoryId: string; groupId: string; capacity: number;
}
interface Group {
  id: string; name: string; maxConcurrent: number | null;
}
interface Category {
  id: string; name: string;
  similarityCriteria: Array<{ code: string; name: string; fieldPath: string }>;
}
interface Task {
  id: string; elementId: string; jobId: string; sequenceOrder: number;
  status: string; type: string;
  stationId: string | null; providerId?: string | null;
  duration: { setupMinutes: number; runMinutes: number } | null;
  durationOpenDays?: number | null;
}
interface Element {
  id: string; name: string; jobId: string;
  prerequisiteElementIds: string[]; taskIds: string[];
  spec?: Record<string, string>;
}
interface Assignment {
  id: string; taskId: string; targetId: string; isOutsourced: boolean;
  scheduledStart: string; scheduledEnd: string;
  isCompleted: boolean;
}
interface Job {
  id: string; reference: string; client: string; description: string;
  status: string; workshopExitDate: string;
  elementIds: string[]; taskIds: string[];
  requiredJobIds: string[];
}
interface Snapshot {
  version: number; generatedAt: string;
  stations: Station[]; categories?: Category[]; groups?: Group[];
  providers?: any[];
  jobs: Job[]; elements: Element[]; tasks: Task[];
  assignments: Assignment[];
  conflicts?: any; lateJobs?: any;
}

// ─── Helpers ───

function loadSnapshot(path: string): Snapshot {
  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  return raw.snapshot ?? raw;
}

function toUTC(iso: string): number { return new Date(iso).getTime(); }

function fmt(ms: number): string {
  if (!isFinite(ms)) return '(none)';
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function fmtMin(ms: number): string {
  const m = Math.round(ms / 60000);
  const h = Math.floor(Math.abs(m) / 60);
  const r = Math.abs(m) % 60;
  const sign = m < 0 ? '-' : '+';
  return `${sign}${h}h${String(r).padStart(2, '0')}m`;
}

function taskDuration(task: Task): string {
  if (task.duration) {
    const total = task.duration.setupMinutes + task.duration.runMinutes;
    return `${total}min`;
  }
  if (task.durationOpenDays != null) return `${task.durationOpenDays}days`;
  return '?';
}

function buildMaps(snap: Snapshot) {
  const stationMap = new Map(snap.stations.map(s => [s.id, s]));
  const groupMap = new Map((snap.groups ?? []).map(g => [g.id, g]));
  const categoryMap = new Map((snap.categories ?? []).map(c => [c.id, c]));
  const taskMap = new Map(snap.tasks.map(t => [t.id, t]));
  const elementMap = new Map(snap.elements.map(e => [e.id, e]));
  const jobMap = new Map(snap.jobs.map(j => [j.id, j]));
  const assignMap = new Map(snap.assignments.map(a => [a.taskId, a]));
  return { stationMap, groupMap, categoryMap, taskMap, elementMap, jobMap, assignMap };
}

// ─── Analysis: Unplaced Tasks ───

function analyzeUnplaced(snap: Snapshot, label: string) {
  const { stationMap, taskMap, elementMap, jobMap, assignMap } = buildMaps(snap);
  const assignedIds = new Set(snap.assignments.map(a => a.taskId));

  const unplaced = snap.tasks.filter(t => !assignedIds.has(t.id));
  const placedCount = snap.tasks.length - unplaced.length;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`UNPLACED TASKS — ${label}`);
  console.log('='.repeat(80));
  console.log(`Tasks: ${snap.tasks.length} total, ${placedCount} placed, ${unplaced.length} unplaced`);

  if (unplaced.length === 0) {
    console.log('All tasks are placed!');
    return;
  }

  // Group by job
  const byJob = new Map<string, Task[]>();
  for (const task of unplaced) {
    const job = jobMap.get(task.jobId);
    const key = job ? `${job.reference} (${job.client})` : 'unknown';
    if (!byJob.has(key)) byJob.set(key, []);
    byJob.get(key)!.push(task);
  }

  for (const [jobRef, tasks] of byJob) {
    console.log(`\n  Job ${jobRef}:`);
    for (const task of tasks) {
      const element = elementMap.get(task.elementId);
      const station = task.stationId ? stationMap.get(task.stationId) : null;
      const target = station?.name ?? (task.providerId ? `provider:${task.providerId}` : 'no-target');
      const isInternal = task.type === 'Internal';

      const reasons: string[] = [];

      if (isInternal && !task.stationId) reasons.push('internal task with no station');
      if (!isInternal && !task.providerId) reasons.push('outsourced task with no provider');

      if (element) {
        const siblings = element.taskIds
          .map(tid => taskMap.get(tid)).filter((t): t is Task => !!t)
          .sort((a, b) => a.sequenceOrder - b.sequenceOrder);

        const unplacedPreds = siblings.filter(
          s => s.sequenceOrder < task.sequenceOrder && !assignedIds.has(s.id)
        );
        if (unplacedPreds.length > 0) {
          reasons.push(`predecessor(s) not placed: ${unplacedPreds.map(t => `seq${t.sequenceOrder}`).join(', ')}`);
        }

        for (const prereqId of element.prerequisiteElementIds) {
          const prereqEl = elementMap.get(prereqId);
          if (!prereqEl) continue;
          const unplacedPrereqs = prereqEl.taskIds
            .map(tid => taskMap.get(tid)).filter((t): t is Task => !!t)
            .filter(t => !assignedIds.has(t.id));
          if (unplacedPrereqs.length > 0) {
            reasons.push(`prerequisite element "${prereqEl.name}" has unplaced tasks`);
          }
        }

        // Show successor placement (useful for ALAP debugging)
        const successor = siblings.find(s => s.sequenceOrder > task.sequenceOrder);
        if (successor) {
          const succA = assignMap.get(successor.id);
          if (succA) reasons.push(`successor placed at ${succA.scheduledStart}`);
          else reasons.push('successor also unplaced');
        }
      }

      console.log(`    [${task.status}] seq:${task.sequenceOrder} ${taskDuration(task)} ${isInternal ? 'internal' : 'outsourced'} → ${target}`);
      for (const r of reasons) console.log(`      - ${r}`);
    }
  }
}

// ─── Analysis: Conflict Checks ───

function analyzeConflicts(snap: Snapshot, label: string) {
  const { stationMap, groupMap, taskMap, elementMap, jobMap, assignMap } = buildMaps(snap);

  console.log(`\n${'='.repeat(80)}`);
  console.log(`CONFLICT CHECKS — ${label}`);
  console.log('='.repeat(80));

  // Station overlap
  console.log('\n--- Station Overlap ---');
  const byStation = new Map<string, Array<{ taskId: string; start: number; end: number; jobRef: string; elemName: string }>>();
  for (const a of snap.assignments) {
    if (a.isOutsourced) continue;
    const task = taskMap.get(a.taskId);
    const elem = task ? elementMap.get(task.elementId) : undefined;
    const job = task ? jobMap.get(task.jobId) : undefined;
    if (!byStation.has(a.targetId)) byStation.set(a.targetId, []);
    byStation.get(a.targetId)!.push({
      taskId: a.taskId, start: toUTC(a.scheduledStart), end: toUTC(a.scheduledEnd),
      jobRef: job?.reference ?? '?', elemName: elem?.name ?? '?',
    });
  }

  let stationConflicts = 0;
  for (const [stationId, tasks] of byStation) {
    tasks.sort((a, b) => a.start - b.start);
    for (let i = 0; i < tasks.length; i++) {
      for (let j = i + 1; j < tasks.length; j++) {
        if (tasks[i].end > tasks[j].start && tasks[i].start < tasks[j].end) {
          const station = stationMap.get(stationId);
          console.log(`  OVERLAP on ${station?.name}:`);
          console.log(`    A: Job ${tasks[i].jobRef}/${tasks[i].elemName} [${fmt(tasks[i].start)} → ${fmt(tasks[i].end)})`);
          console.log(`    B: Job ${tasks[j].jobRef}/${tasks[j].elemName} [${fmt(tasks[j].start)} → ${fmt(tasks[j].end)})`);
          stationConflicts++;
        }
      }
    }
  }
  console.log(`  Station overlaps: ${stationConflicts}`);

  // Within-element precedence
  console.log('\n--- Precedence (within element) ---');
  let precedenceConflicts = 0;
  for (const elem of snap.elements) {
    const elemTasks = elem.taskIds
      .map(tid => taskMap.get(tid)!).filter(Boolean)
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    for (let i = 1; i < elemTasks.length; i++) {
      const predA = assignMap.get(elemTasks[i - 1].id);
      const currA = assignMap.get(elemTasks[i].id);
      if (!predA || !currA) continue;
      const predEnd = toUTC(predA.scheduledEnd);
      const currStart = toUTC(currA.scheduledStart);
      if (predEnd > currStart) {
        const job = jobMap.get(elem.jobId);
        console.log(`  VIOLATION: Job ${job?.reference} / ${elem.name} seq=${elemTasks[i - 1].sequenceOrder}→${elemTasks[i].sequenceOrder} gap=${fmtMin(currStart - predEnd)}`);
        precedenceConflicts++;
      }
    }
  }
  console.log(`  Within-element violations: ${precedenceConflicts}`);

  // Cross-element precedence
  console.log('\n--- Precedence (cross-element) ---');
  let crossConflicts = 0;
  for (const elem of snap.elements) {
    if (!elem.prerequisiteElementIds?.length) continue;
    const elemTasks = elem.taskIds
      .map(tid => taskMap.get(tid)!).filter(Boolean)
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    if (!elemTasks.length) continue;
    const firstA = assignMap.get(elemTasks[0].id);
    if (!firstA) continue;
    const firstStart = toUTC(firstA.scheduledStart);

    for (const prereqId of elem.prerequisiteElementIds) {
      const prereqEl = elementMap.get(prereqId);
      if (!prereqEl) continue;
      const prereqTasks = prereqEl.taskIds
        .map(tid => taskMap.get(tid)!).filter(Boolean)
        .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
      if (!prereqTasks.length) continue;
      const lastA = assignMap.get(prereqTasks[prereqTasks.length - 1].id);
      if (!lastA) continue;
      if (toUTC(lastA.scheduledEnd) > firstStart) {
        const job = jobMap.get(elem.jobId);
        console.log(`  VIOLATION: Job ${job?.reference} "${prereqEl.name}" ends after "${elem.name}" starts, gap=${fmtMin(firstStart - toUTC(lastA.scheduledEnd))}`);
        crossConflicts++;
      }
    }
  }
  console.log(`  Cross-element violations: ${crossConflicts}`);

  // Group capacity
  console.log('\n--- Group Capacity ---');
  let groupViolations = 0;
  const stationGroupMap = new Map(snap.stations.map(s => [s.id, s.groupId]));
  const byGroup = new Map<string, Array<{ start: number; end: number }>>();
  for (const a of snap.assignments) {
    if (a.isOutsourced) continue;
    const groupId = stationGroupMap.get(a.targetId);
    if (!groupId) continue;
    if (!byGroup.has(groupId)) byGroup.set(groupId, []);
    byGroup.get(groupId)!.push({ start: toUTC(a.scheduledStart), end: toUTC(a.scheduledEnd) });
  }
  for (const [groupId, assignments] of byGroup) {
    const group = groupMap.get(groupId);
    if (!group?.maxConcurrent) continue;
    const events: Array<{ time: number; type: 's' | 'e' }> = [];
    for (const a of assignments) {
      events.push({ time: a.start, type: 's' });
      events.push({ time: a.end, type: 'e' });
    }
    events.sort((a, b) => a.time - b.time || (a.type === 'e' ? -1 : 1));
    let concurrent = 0, peak = 0;
    for (const ev of events) {
      concurrent += ev.type === 's' ? 1 : -1;
      if (concurrent > peak) peak = concurrent;
    }
    if (peak > group.maxConcurrent) {
      console.log(`  VIOLATION: "${group.name}" max=${group.maxConcurrent}, peak=${peak}`);
      groupViolations++;
    }
  }
  console.log(`  Group capacity violations: ${groupViolations}`);

  const total = stationConflicts + precedenceConflicts + crossConflicts + groupViolations;
  console.log(`\n  TOTAL CONFLICTS: ${total}${total === 0 ? ' (clean)' : ''}`);
  return total;
}

// ─── Analysis: Diff (two snapshots) ───

function analyzeDiff(before: Snapshot, after: Snapshot) {
  const { taskMap, elementMap, jobMap, stationMap } = buildMaps(after);
  const assignBefore = new Map(before.assignments.map(a => [a.taskId, a]));
  const assignAfter = new Map(after.assignments.map(a => [a.taskId, a]));

  console.log(`\n${'='.repeat(80)}`);
  console.log('ASSIGNMENT DIFF');
  console.log('='.repeat(80));
  console.log(`BEFORE: v${before.version} at ${before.generatedAt} (${before.assignments.length} assignments)`);
  console.log(`AFTER:  v${after.version} at ${after.generatedAt} (${after.assignments.length} assignments)`);

  const changes: Array<{
    jobRef: string; elemName: string; stationName: string; seq: number;
    bStart: number; bEnd: number; aStart: number; aEnd: number; delta: number;
  }> = [];
  let unchanged = 0;
  let newAssignments = 0;
  let removed = 0;

  for (const [taskId, afterA] of assignAfter) {
    const beforeA = assignBefore.get(taskId);
    if (!beforeA) { newAssignments++; continue; }
    const bS = toUTC(beforeA.scheduledStart), bE = toUTC(beforeA.scheduledEnd);
    const aS = toUTC(afterA.scheduledStart), aE = toUTC(afterA.scheduledEnd);
    if (bS === aS && bE === aE) { unchanged++; continue; }
    const task = taskMap.get(taskId);
    const elem = task ? elementMap.get(task.elementId) : undefined;
    const job = task ? jobMap.get(task.jobId) : undefined;
    const station = stationMap.get(afterA.targetId);
    changes.push({
      jobRef: job?.reference ?? '?', elemName: elem?.name ?? '?',
      stationName: station?.name ?? '?', seq: task?.sequenceOrder ?? 0,
      bStart: bS, bEnd: bE, aStart: aS, aEnd: aE, delta: aS - bS,
    });
  }

  for (const taskId of assignBefore.keys()) {
    if (!assignAfter.has(taskId)) removed++;
  }

  console.log(`  New: ${newAssignments}, Removed: ${removed}, Changed: ${changes.length}, Unchanged: ${unchanged}`);

  if (changes.length > 0) {
    changes.sort((a, b) => a.aStart - b.aStart);
    console.log('\n  Changed assignments:');
    for (const c of changes) {
      const dir = c.delta < 0 ? 'EARLIER' : c.delta > 0 ? 'LATER' : 'SAME';
      console.log(`    Job ${c.jobRef} / ${c.elemName} seq=${c.seq} @ ${c.stationName}: ${fmtMin(c.delta)} ${dir}`);
    }
    const earlier = changes.filter(c => c.delta < 0).length;
    const later = changes.filter(c => c.delta > 0).length;
    console.log(`\n  Summary: ${earlier} earlier, ${later} later`);
  }

  // Schedule span
  function span(assignments: Assignment[]) {
    let min = Infinity, max = -Infinity;
    for (const a of assignments) {
      const s = toUTC(a.scheduledStart), e = toUTC(a.scheduledEnd);
      if (s < min) min = s;
      if (e > max) max = e;
    }
    return { min, max };
  }
  const spanB = span(before.assignments);
  const spanA = span(after.assignments);
  if (isFinite(spanB.min) && isFinite(spanA.min)) {
    console.log(`\n  Span BEFORE: ${fmt(spanB.min)} → ${fmt(spanB.max)} (${fmtMin(spanB.max - spanB.min)})`);
    console.log(`  Span AFTER:  ${fmt(spanA.min)} → ${fmt(spanA.max)} (${fmtMin(spanA.max - spanA.min)})`);
  }

  // On-time / Late
  console.log(`\n${'='.repeat(80)}`);
  console.log('ON-TIME / LATE ANALYSIS');
  console.log('='.repeat(80));

  for (const job of after.jobs) {
    const exitDate = toUTC(job.workshopExitDate);
    let maxB = 0, maxA = 0;
    for (const tid of job.taskIds) {
      const bA = assignBefore.get(tid);
      if (bA) { const e = toUTC(bA.scheduledEnd); if (e > maxB) maxB = e; }
      const aA = assignAfter.get(tid);
      if (aA) { const e = toUTC(aA.scheduledEnd); if (e > maxA) maxA = e; }
    }
    const wasLate = maxB > exitDate;
    const isLate = maxA > exitDate;
    const status = wasLate && isLate ? 'LATE->LATE'
      : !wasLate && isLate ? 'ON-TIME->LATE'
      : wasLate && !isLate ? 'LATE->ON-TIME'
      : 'ON-TIME->ON-TIME';
    const marker = status === 'ON-TIME->LATE' ? ' *** REGRESSION ***'
      : status === 'LATE->ON-TIME' ? ' ** IMPROVEMENT **' : '';

    console.log(`  Job ${job.reference} (${job.client}): ${status}${marker}  margin: ${fmtMin(exitDate - maxA)}`);
  }
}

// ─── Printing station similarity (optional, for compaction analysis) ───

function analyzeSimilarity(snap: Snapshot) {
  const { stationMap, categoryMap, taskMap, elementMap, jobMap } = buildMaps(snap);

  // Find offset press category
  let presseCategoryId: string | null = null;
  for (const [id, cat] of categoryMap) {
    if (cat.name.toLowerCase().includes('offset')) { presseCategoryId = id; break; }
  }
  if (!presseCategoryId || !categoryMap.get(presseCategoryId)?.similarityCriteria?.length) return;

  const presseCategory = categoryMap.get(presseCategoryId)!;
  const pressStations = snap.stations.filter(s => s.categoryId === presseCategoryId);
  if (pressStations.length === 0) return;

  // Build station assignment lists
  const byStation = new Map<string, Array<{ start: number; taskId: string; jobRef: string; elemName: string }>>();
  for (const a of snap.assignments) {
    if (a.isOutsourced) continue;
    const station = stationMap.get(a.targetId);
    if (!station || station.categoryId !== presseCategoryId) continue;
    const task = taskMap.get(a.taskId);
    const elem = task ? elementMap.get(task.elementId) : undefined;
    const job = task ? jobMap.get(task.jobId) : undefined;
    if (!byStation.has(a.targetId)) byStation.set(a.targetId, []);
    byStation.get(a.targetId)!.push({
      start: toUTC(a.scheduledStart), taskId: a.taskId,
      jobRef: job?.reference ?? '?', elemName: elem?.name ?? '?',
    });
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('PRINTING STATION SIMILARITY');
  console.log('='.repeat(80));

  for (const station of pressStations) {
    const tasks = byStation.get(station.id) ?? [];
    if (tasks.length < 2) continue;
    const sorted = [...tasks].sort((a, b) => a.start - b.start);

    console.log(`\n  ${station.name} (${sorted.length} tasks):`);
    for (let i = 0; i < sorted.length; i++) {
      const task = taskMap.get(sorted[i].taskId)!;
      const elem = elementMap.get(task.elementId)!;
      const spec = elem.spec ?? {};
      let note = '';
      if (i > 0) {
        const prevElem = elementMap.get(taskMap.get(sorted[i - 1].taskId)!.elementId)!;
        const prevSpec = prevElem.spec ?? {};
        const same: string[] = [], diff: string[] = [];
        for (const crit of presseCategory.similarityCriteria) {
          const cur = spec[crit.fieldPath], prev = prevSpec[crit.fieldPath];
          if (cur === prev) same.push(`${crit.fieldPath}=${cur}`);
          else diff.push(`${crit.fieldPath}: "${prev}" → "${cur}"`);
        }
        if (diff.length > 0) note = ` DIFF=[${diff.join(', ')}]`;
      }
      console.log(`    [${i}] Job ${sorted[i].jobRef}/${sorted[i].elemName} | ${spec.format ?? ''} ${spec.papier ?? ''} ${spec.impression ?? ''}${note}`);
    }
  }
}

// ─── Main ───

const args = process.argv.slice(2);

if (args.length === 1) {
  const snap = loadSnapshot(args[0]);
  analyzeUnplaced(snap, args[0]);
  analyzeConflicts(snap, args[0]);
  analyzeSimilarity(snap);
} else if (args.length === 2) {
  const before = loadSnapshot(args[0]);
  const after = loadSnapshot(args[1]);
  analyzeDiff(before, after);
  analyzeUnplaced(after, 'AFTER');
  analyzeConflicts(after, 'AFTER');
  analyzeSimilarity(after);
} else {
  console.log('Usage:');
  console.log('  node --experimental-strip-types tools/analyze_snapshots.ts <snapshot.json>');
  console.log('  node --experimental-strip-types tools/analyze_snapshots.ts <before.json> <after.json>');
  process.exit(1);
}
