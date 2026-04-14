import type { ScheduleSnapshot, TaskAssignment } from '@flux/types';
import { isInternalTask } from '@flux/types';

// ── Datum types for each chart ──────────────────────────────────

export interface SlackUrgencyDatum {
  jobId: string;
  reference: string;
  client: string;
  daysToDeadline: number;
  totalProductionHours: number;
  slackHours: number;
  isLate: boolean;
  delayDays: number;
  priorityTier: number;
  deadline: Date;
}

export interface ScheduleOrderDatum {
  jobId: string;
  reference: string;
  client: string;
  deadlineDate: Date;
  firstScheduledStart: Date;
  priorityTier: number;
  isLate: boolean;
}

export interface LatenessByPriorityDatum {
  tier: number;
  tierLabel: string;
  onTimeCount: number;
  lateCount: number;
  total: number;
}

export interface SlackDistributionDatum {
  jobId: string;
  reference: string;
  slackHours: number;
  isLate: boolean;
}

export interface StationUtilizationBlock {
  hour: number;
  startTime: Date;
  utilization: number;
}

export interface StationUtilizationDatum {
  stationId: string;
  stationName: string;
  categoryId: string;
  categoryName: string;
  blocks: StationUtilizationBlock[];
}

export interface StatsData {
  slackUrgency: SlackUrgencyDatum[];
  scheduleOrder: ScheduleOrderDatum[];
  latenessByPriority: LatenessByPriorityDatum[];
  slackDistribution: SlackDistributionDatum[];
  stationUtilization: StationUtilizationDatum[];
  horizonStart: Date;
  horizonEnd: Date;
}

// ── Constants ───────────────────────────────────────────────────

const PRIORITY_LABELS = ['Impératif', 'Important', 'Standard', 'Flexible'];
const WORKING_HOURS_PER_DAY = 8;

// ── Main derivation (follows scheduleScoring.ts pattern) ────────

export function deriveStatsData(snapshot: ScheduleSnapshot): StatsData {
  const taskMap = new Map(snapshot.tasks.map((t) => [t.id, t]));
  const elementMap = new Map(snapshot.elements.map((e) => [e.id, e]));
  const categoryMap = new Map(snapshot.categories.map((c) => [c.id, c]));
  const lateJobMap = new Map(snapshot.lateJobs.map((lj) => [lj.jobId, lj]));
  const lateJobIdSet = new Set(snapshot.lateJobs.map((lj) => lj.jobId));

  // Group assignments by taskId
  const assignmentsByTaskId = new Map<string, TaskAssignment[]>();
  for (const a of snapshot.assignments) {
    const list = assignmentsByTaskId.get(a.taskId) || [];
    list.push(a);
    assignmentsByTaskId.set(a.taskId, list);
  }

  // Horizon bounds from assignments
  let horizonStartMs = Infinity;
  let horizonEndMs = -Infinity;
  for (const a of snapshot.assignments) {
    const start = new Date(a.scheduledStart).getTime();
    const end = new Date(a.scheduledEnd).getTime();
    if (start < horizonStartMs) horizonStartMs = start;
    if (end > horizonEndMs) horizonEndMs = end;
  }
  if (!isFinite(horizonStartMs)) horizonStartMs = Date.now();
  if (!isFinite(horizonEndMs)) horizonEndMs = horizonStartMs + 14 * 86400000;

  const horizonStart = new Date(horizonStartMs);
  const horizonEnd = new Date(horizonEndMs);

  // Which jobs have at least one scheduled task?
  const scheduledJobIds = new Set<string>();
  for (const a of snapshot.assignments) {
    const task = taskMap.get(a.taskId);
    if (!task) continue;
    const el = elementMap.get(task.elementId);
    if (el) scheduledJobIds.add(el.jobId);
  }

  // ── Per-job metrics ─────────────────────────────────────────
  const slackUrgency: SlackUrgencyDatum[] = [];
  const scheduleOrder: ScheduleOrderDatum[] = [];
  const slackDistribution: SlackDistributionDatum[] = [];

  for (const job of snapshot.jobs) {
    if (!scheduledJobIds.has(job.id)) continue;

    // Gather all task IDs for this job
    const jobTaskIds = new Set<string>();
    for (const el of snapshot.elements) {
      if (el.jobId === job.id) {
        for (const tid of el.taskIds) jobTaskIds.add(tid);
      }
    }

    // Total production time (internal tasks only)
    let totalProductionMin = 0;
    for (const tid of jobTaskIds) {
      const task = taskMap.get(tid);
      if (task && isInternalTask(task)) {
        totalProductionMin += task.duration.setupMinutes + task.duration.runMinutes;
      }
    }
    const totalProductionHours = totalProductionMin / 60;

    // Days to deadline from horizon start
    const deadline = new Date(job.workshopExitDate);
    const daysToDeadline = (deadline.getTime() - horizonStartMs) / 86400000;
    const slackHours = daysToDeadline * WORKING_HOURS_PER_DAY - totalProductionHours;

    const isLate = lateJobIdSet.has(job.id);
    const delayDays = lateJobMap.get(job.id)?.delayDays ?? 0;

    slackUrgency.push({
      jobId: job.id,
      reference: job.reference,
      client: job.client,
      daysToDeadline,
      totalProductionHours,
      slackHours,
      isLate,
      delayDays,
      priorityTier: job.deadlinePriority,
      deadline,
    });

    slackDistribution.push({
      jobId: job.id,
      reference: job.reference,
      slackHours,
      isLate,
    });

    // First scheduled start
    let firstStartMs = Infinity;
    for (const tid of jobTaskIds) {
      for (const a of assignmentsByTaskId.get(tid) || []) {
        const ms = new Date(a.scheduledStart).getTime();
        if (ms < firstStartMs) firstStartMs = ms;
      }
    }

    if (isFinite(firstStartMs)) {
      scheduleOrder.push({
        jobId: job.id,
        reference: job.reference,
        client: job.client,
        deadlineDate: deadline,
        firstScheduledStart: new Date(firstStartMs),
        priorityTier: job.deadlinePriority,
        isLate,
      });
    }
  }

  // ── Lateness by priority tier ─────────────────────────────────
  const latenessByPriority: LatenessByPriorityDatum[] = [0, 1, 2, 3].map((tier) => {
    const tierJobs = slackUrgency.filter((j) => j.priorityTier === tier);
    return {
      tier,
      tierLabel: PRIORITY_LABELS[tier],
      onTimeCount: tierJobs.filter((j) => !j.isLate).length,
      lateCount: tierJobs.filter((j) => j.isLate).length,
      total: tierJobs.length,
    };
  });

  // ── Station utilization heatmap ───────────────────────────────
  const displayHours = Math.min(
    Math.ceil((horizonEndMs - horizonStartMs) / 3600000),
    7 * 10, // cap at 7 days of 10 working hours
  );

  const assignmentsByStation = new Map<string, TaskAssignment[]>();
  for (const a of snapshot.assignments) {
    if (a.isOutsourced) continue;
    const list = assignmentsByStation.get(a.targetId) || [];
    list.push(a);
    assignmentsByStation.set(a.targetId, list);
  }

  const stationUtilization: StationUtilizationDatum[] = snapshot.stations.map((st) => {
    const stAssignments = assignmentsByStation.get(st.id) || [];
    const category = categoryMap.get(st.categoryId);

    const blocks: StationUtilizationBlock[] = [];
    for (let h = 0; h < displayHours; h++) {
      const blockStartMs = horizonStartMs + h * 3600000;
      const blockEndMs = blockStartMs + 3600000;

      let occupiedMs = 0;
      for (const a of stAssignments) {
        const aStart = new Date(a.scheduledStart).getTime();
        const aEnd = new Date(a.scheduledEnd).getTime();
        const overlapStart = Math.max(aStart, blockStartMs);
        const overlapEnd = Math.min(aEnd, blockEndMs);
        if (overlapEnd > overlapStart) occupiedMs += overlapEnd - overlapStart;
      }

      blocks.push({
        hour: h,
        startTime: new Date(blockStartMs),
        utilization: Math.min(1, occupiedMs / 3600000),
      });
    }

    return {
      stationId: st.id,
      stationName: st.name,
      categoryId: st.categoryId,
      categoryName: category?.name ?? 'Unknown',
      blocks,
    };
  });

  return {
    slackUrgency,
    scheduleOrder,
    latenessByPriority,
    slackDistribution,
    stationUtilization,
    horizonStart,
    horizonEnd,
  };
}
