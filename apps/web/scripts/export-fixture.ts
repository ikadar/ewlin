/**
 * Export a named fixture as PHP-compatible JSON to stdout.
 *
 * Usage:
 *   npx tsx apps/web/scripts/export-fixture.ts louis-phase-1 > services/php-api/fixtures/louis-phase-1.json
 */
import { v5 as uuidv5 } from 'uuid';
import { createLouisPhase1Fixture } from '../src/mock/fixtures/louis-phase-1';
import type { ScheduleSnapshot, Task, InternalTask, OutsourcedTask } from '@flux/types';

// ---------------------------------------------------------------------------
// Deterministic UUID v5 mapping
// ---------------------------------------------------------------------------
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // DNS namespace UUID

const idCache = new Map<string, string>();

function toUuid(id: string): string {
  let mapped = idCache.get(id);
  if (!mapped) {
    mapped = uuidv5(id, NAMESPACE);
    idCache.set(id, mapped);
  }
  return mapped;
}

// ---------------------------------------------------------------------------
// Fixture registry
// ---------------------------------------------------------------------------
const FIXTURES: Record<string, () => ScheduleSnapshot> = {
  'louis-phase-1': createLouisPhase1Fixture,
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const fixtureName = process.argv[2];
if (!fixtureName || !FIXTURES[fixtureName]) {
  console.error(`Usage: npx tsx export-fixture.ts <fixture-name>`);
  console.error(`Available: ${Object.keys(FIXTURES).join(', ')}`);
  process.exit(1);
}

const snapshot = FIXTURES[fixtureName]();

// ---------------------------------------------------------------------------
// Map IDs
// ---------------------------------------------------------------------------

function mapCategory(c: (typeof snapshot.categories)[number]) {
  return {
    id: toUuid(c.id),
    name: c.name,
    description: c.description ?? null,
    similarityCriteria: c.similarityCriteria,
  };
}

function mapGroup(g: (typeof snapshot.groups)[number]) {
  return {
    id: toUuid(g.id),
    name: g.name,
    maxConcurrent: g.maxConcurrent,
    isOutsourcedProviderGroup: g.isOutsourcedProviderGroup,
  };
}

function mapStation(s: (typeof snapshot.stations)[number]) {
  return {
    id: toUuid(s.id),
    name: s.name,
    status: s.status, // PascalCase in PHP: Available, Maintenance, etc.
    categoryId: toUuid(s.categoryId),
    groupId: toUuid(s.groupId),
    capacity: s.capacity,
    operatingSchedule: s.operatingSchedule,
    scheduleExceptions: s.exceptions ?? [],
  };
}

function mapProvider(p: (typeof snapshot.providers)[number]) {
  return {
    id: toUuid(p.id),
    name: p.name,
    status: p.status, // PascalCase in PHP: Active, Inactive
    supportedActionTypes: p.supportedActionTypes,
    latestDepartureTime: p.latestDepartureTime,
    receptionTime: p.receptionTime,
    transitDays: p.transitDays,
    groupId: toUuid(p.groupId),
  };
}

function mapJob(j: (typeof snapshot.jobs)[number]) {
  return {
    id: toUuid(j.id),
    reference: j.reference,
    client: j.client,
    description: j.description,
    status: j.status.toLowerCase(), // Planned → planned
    workshopExitDate: j.workshopExitDate,
    quantity: j.quantity ?? null,
    fullyScheduled: j.fullyScheduled,
    color: j.color,
    requiredJobIds: [],
    elementIds: j.elementIds.map(toUuid),
    taskIds: j.taskIds.map(toUuid),
    createdAt: j.createdAt,
    updatedAt: j.updatedAt,
  };
}

function mapElement(e: (typeof snapshot.elements)[number]) {
  return {
    id: toUuid(e.id),
    jobId: toUuid(e.jobId),
    name: e.name,
    label: e.label ?? null,
    prerequisiteElementIds: e.prerequisiteElementIds.map(toUuid),
    taskIds: e.taskIds.map(toUuid),
    spec: e.spec ?? null,
    paperStatus: e.paperStatus,
    batStatus: e.batStatus,
    plateStatus: e.plateStatus,
    formeStatus: e.formeStatus,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

function isInternal(t: Task): t is InternalTask {
  return t.type === 'Internal';
}

function isOutsourced(t: Task): t is OutsourcedTask {
  return t.type === 'Outsourced';
}

function mapTask(t: Task) {
  const base = {
    id: toUuid(t.id),
    elementId: toUuid(t.elementId),
    sequenceOrder: t.sequenceOrder + 1, // 0-indexed → 1-indexed
    status: t.status.toLowerCase(),     // Ready → ready
    comment: t.comment ?? null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };

  if (isInternal(t)) {
    return {
      ...base,
      taskType: 'internal',
      stationId: toUuid(t.stationId),
      setupMinutes: t.duration.setupMinutes,
      runMinutes: t.duration.runMinutes,
      providerId: null,
      actionType: null,
      durationOpenDays: null,
    };
  }

  if (isOutsourced(t)) {
    return {
      ...base,
      taskType: 'outsourced',
      stationId: null,
      setupMinutes: null,
      runMinutes: null,
      providerId: toUuid(t.providerId),
      actionType: t.actionType,
      durationOpenDays: t.duration.openDays,
    };
  }

  throw new Error(`Unknown task type: ${(t as Task).type}`);
}

// ---------------------------------------------------------------------------
// Build output
// ---------------------------------------------------------------------------
const output = {
  fixture: fixtureName,
  exportedAt: new Date().toISOString(),
  categories: snapshot.categories.map(mapCategory),
  groups: snapshot.groups.map(mapGroup),
  stations: snapshot.stations.map(mapStation),
  providers: snapshot.providers.map(mapProvider),
  jobs: snapshot.jobs.map(mapJob),
  elements: snapshot.elements.map(mapElement),
  tasks: snapshot.tasks.map(mapTask),
};

console.log(JSON.stringify(output, null, 2));
