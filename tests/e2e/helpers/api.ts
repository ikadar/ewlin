/**
 * PHP API client for E2E tests.
 * Communicates with the scheduler API running on Docker (default: localhost:8080).
 */

export interface Assignment {
  taskId: string;
  targetId: string;
  isOutsourced: boolean;
  scheduledStart: string;
  scheduledEnd: string;
  isCompleted: boolean;
  completedAt: string | null;
}

export interface Snapshot {
  version: number;
  generatedAt: string;
  stations: Station[];
  categories: Category[];
  groups: Group[];
  providers: Provider[];
  jobs: Job[];
  elements: Element[];
  tasks: Task[];
  assignments: SnapshotAssignment[];
  conflicts: Conflict[];
  lateJobs: LateJob[];
}

export interface Station {
  id: string;
  name: string;
  displayOrder: number;
  status: string;
  categoryId: string;
  groupId: string;
  capacity: number;
  operatingSchedule: Record<string, DaySchedule>;
  scheduleExceptions: unknown[];
}

export interface DaySchedule {
  isOperating: boolean;
  slots: { start: string; end: string }[];
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  similarityCriteria: unknown[];
}

export interface Group {
  id: string;
  name: string;
  maxConcurrent: number;
  isOutsourcedProviderGroup: boolean;
}

export interface Provider {
  id: string;
  name: string;
  status: string;
  supportedActionTypes: string[];
  latestDepartureTime: string;
  receptionTime: string;
  transitDays: number;
  groupId: string;
}

export interface Job {
  id: string;
  reference: string;
  client: string;
  description: string;
  status: string;
  workshopExitDate: string;
  quantity: number;
  fullyScheduled: boolean;
  color: string;
  requiredJobIds: string[];
  elementIds: string[];
  taskIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Element {
  id: string;
  jobId: string;
  name: string;
  label: string | null;
  prerequisiteElementIds: string[];
  taskIds: string[];
  spec: Record<string, unknown> | null;
  paperStatus: string;
  batStatus: string;
  plateStatus: string;
  formeStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  elementId: string;
  jobId: string;
  sequenceOrder: number;
  status: string;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  type: 'Internal' | 'Outsourced';
  stationId?: string;
  duration: {
    setupMinutes?: number;
    runMinutes?: number;
    openDays?: number;
    latestDepartureTime?: string;
    receptionTime?: string;
  };
  providerId?: string;
  actionType?: string;
}

export interface SnapshotAssignment {
  id: string;
  taskId: string;
  targetId: string;
  isOutsourced: boolean;
  scheduledStart: string;
  scheduledEnd: string;
  isCompleted: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Conflict {
  type: string;
  message: string;
  taskId: string;
  relatedTaskId?: string;
  targetId?: string;
  details?: Record<string, unknown>;
}

export interface LateJob {
  jobId: string;
  deadline: string;
  expectedCompletion: string;
  delayDays: number;
}

export interface AssignError {
  error: string;
  message: string;
  conflicts?: Conflict[];
  suggestedStart?: string;
}

export class SchedulerAPI {
  constructor(private baseUrl = 'http://localhost:8080') {}

  async getSnapshot(): Promise<Snapshot> {
    const res = await fetch(`${this.baseUrl}/api/v1/schedule/snapshot`);
    if (!res.ok) {
      throw new Error(`Snapshot failed: ${res.status} ${await res.text()}`);
    }
    return res.json() as Promise<any>;
  }

  async assignTask(
    taskId: string,
    targetId: string,
    scheduledStart: string,
    bypassPrecedence = false,
  ): Promise<Assignment> {
    const res = await fetch(`${this.baseUrl}/api/v1/tasks/${taskId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId, scheduledStart, bypassPrecedence }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Assign failed (${res.status}): ${body}`);
    }
    return res.json() as Promise<any>;
  }

  async rescheduleTask(
    taskId: string,
    targetId: string,
    scheduledStart: string,
    bypassPrecedence = false,
  ): Promise<Assignment> {
    const res = await fetch(`${this.baseUrl}/api/v1/tasks/${taskId}/assign`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId, scheduledStart, bypassPrecedence }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Reschedule failed (${res.status}): ${body}`);
    }
    return res.json() as Promise<any>;
  }

  async recallTask(taskId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v1/tasks/${taskId}/assign`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const body = await res.text();
      // Ignore 400 if task is already unassigned
      if (res.status === 400) return;
      throw new Error(`Recall failed (${res.status}): ${body}`);
    }
  }

  async recallAll(): Promise<void> {
    const snapshot = await this.getSnapshot();
    // Recall all assignments
    for (const assignment of snapshot.assignments) {
      await this.recallTask(assignment.taskId);
    }
    // Also recall any orphaned tasks stuck in "Assigned" status without an assignment
    const assignedTaskIds = new Set(snapshot.assignments.map((a) => a.taskId));
    for (const task of snapshot.tasks) {
      if (task.status === 'Assigned' && !assignedTaskIds.has(task.id)) {
        await this.recallTask(task.id);
      }
    }
  }

  async healthCheck(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v1/schedule/snapshot`);
    if (!res.ok) {
      throw new Error(`Health check failed: ${res.status}`);
    }
  }
}
