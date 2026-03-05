/**
 * Fixture data resolver for E2E tests.
 * Lazy-loads snapshot data once, then resolves human-readable names to UUIDs.
 */

import type { SchedulerAPI, Snapshot } from './api.js';

export interface TaskInfo {
  id: string;
  elementId: string;
  elementName: string;
  jobId: string;
  jobRef: string;
  stationId: string;
  stationName: string;
  sequenceOrder: number;
  setupMinutes: number;
  runMinutes: number;
  totalMinutes: number;
  taskType: 'Internal' | 'Outsourced';
  providerId: string | undefined;
}

export interface StationInfo {
  id: string;
  name: string;
  categoryId: string;
}

export interface JobInfo {
  id: string;
  reference: string;
  description: string;
  elementIds: string[];
  taskIds: string[];
}

export class Fixture {
  private snapshot: Snapshot | null = null;

  constructor(private api: SchedulerAPI) {}

  private async load(): Promise<Snapshot> {
    if (!this.snapshot) {
      this.snapshot = await this.api.getSnapshot();
    }
    return this.snapshot;
  }

  /** Clear cached snapshot so next call re-fetches */
  invalidate(): void {
    this.snapshot = null;
  }

  /**
   * Resolve a task by job reference, element name, and station name.
   * fix.task('L-00001', 'Cahier 1', 'Ryobi 524')
   */
  async task(jobRef: string, elementName: string, stationName: string): Promise<TaskInfo> {
    const snap = await this.load();

    const job = snap.jobs.find((j) => j.reference === jobRef);
    if (!job) throw new Error(`Job not found: ${jobRef}`);

    const element = snap.elements.find(
      (e) => e.jobId === job.id && e.name === elementName,
    );
    if (!element) throw new Error(`Element not found: ${elementName} in job ${jobRef}`);

    const station = snap.stations.find((s) => s.name === stationName);
    if (!station) throw new Error(`Station not found: ${stationName}`);

    const task = snap.tasks.find(
      (t) => t.elementId === element.id && t.stationId === station.id,
    );
    if (!task) {
      throw new Error(
        `Task not found: ${elementName} → ${stationName} in job ${jobRef}`,
      );
    }

    const setup = task.duration.setupMinutes ?? 0;
    const run = task.duration.runMinutes ?? 0;

    return {
      id: task.id,
      elementId: element.id,
      elementName: element.name,
      jobId: job.id,
      jobRef: job.reference,
      stationId: station.id,
      stationName: station.name,
      sequenceOrder: task.sequenceOrder,
      setupMinutes: setup,
      runMinutes: run,
      totalMinutes: setup + run,
      taskType: task.type,
      providerId: task.providerId,
    };
  }

  /**
   * Resolve an outsourced task by job reference and element name.
   * fix.outsourcedTask('L-00010', 'Finition')
   */
  async outsourcedTask(jobRef: string, elementName: string): Promise<TaskInfo> {
    const snap = await this.load();

    const job = snap.jobs.find((j) => j.reference === jobRef);
    if (!job) throw new Error(`Job not found: ${jobRef}`);

    const element = snap.elements.find(
      (e) => e.jobId === job.id && e.name === elementName,
    );
    if (!element) throw new Error(`Element not found: ${elementName} in job ${jobRef}`);

    const task = snap.tasks.find(
      (t) => t.elementId === element.id && t.type === 'Outsourced',
    );
    if (!task) {
      throw new Error(`Outsourced task not found in ${elementName} of job ${jobRef}`);
    }

    const provider = snap.providers.find((p) => p.id === task.providerId);

    return {
      id: task.id,
      elementId: element.id,
      elementName: element.name,
      jobId: job.id,
      jobRef: job.reference,
      stationId: '', // outsourced tasks don't have a station
      stationName: provider?.name ?? 'unknown provider',
      sequenceOrder: task.sequenceOrder,
      setupMinutes: 0,
      runMinutes: 0,
      totalMinutes: 0,
      taskType: 'Outsourced',
      providerId: task.providerId,
    };
  }

  /** Resolve a station by name */
  async station(name: string): Promise<StationInfo> {
    const snap = await this.load();
    const station = snap.stations.find((s) => s.name === name);
    if (!station) throw new Error(`Station not found: ${name}`);
    return { id: station.id, name: station.name, categoryId: station.categoryId };
  }

  /** Resolve a job by reference */
  async job(ref: string): Promise<JobInfo> {
    const snap = await this.load();
    const job = snap.jobs.find((j) => j.reference === ref);
    if (!job) throw new Error(`Job not found: ${ref}`);
    return {
      id: job.id,
      reference: job.reference,
      description: job.description,
      elementIds: job.elementIds,
      taskIds: job.taskIds,
    };
  }

  /** Get all internal tasks for a job, resolved with station info */
  async allInternalTasks(jobRef: string): Promise<TaskInfo[]> {
    const snap = await this.load();
    const job = snap.jobs.find((j) => j.reference === jobRef);
    if (!job) throw new Error(`Job not found: ${jobRef}`);

    const tasks: TaskInfo[] = [];
    for (const element of snap.elements.filter((e) => e.jobId === job.id)) {
      for (const task of snap.tasks.filter(
        (t) => t.elementId === element.id && t.type === 'Internal',
      )) {
        const station = snap.stations.find((s) => s.id === task.stationId);
        const setup = task.duration.setupMinutes ?? 0;
        const run = task.duration.runMinutes ?? 0;
        tasks.push({
          id: task.id,
          elementId: element.id,
          elementName: element.name,
          jobId: job.id,
          jobRef: job.reference,
          stationId: task.stationId!,
          stationName: station?.name ?? 'unknown',
          sequenceOrder: task.sequenceOrder,
          setupMinutes: setup,
          runMinutes: run,
          totalMinutes: setup + run,
          taskType: 'Internal',
          providerId: undefined,
        });
      }
    }
    return tasks;
  }
}
