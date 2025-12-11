import { faker } from '@faker-js/faker';
import { addMinutes } from 'date-fns';
import type {
  ScheduleSnapshot,
  Assignment,
  Operator,
  Equipment,
  Job,
  Task,
  ProposedAssignment,
  CreateOperatorDto,
  UpdateOperatorDto,
  CreateEquipmentDto,
  UpdateEquipmentDto,
  CreateJobDto,
  UpdateJobDto,
  CreateTaskDto,
} from '../types';
import { getMockSnapshot, updateMockSnapshot } from '../mock';

interface MockApiConfig {
  latency: number;
  failureRate: number;
}

const config: MockApiConfig = {
  latency: 150,
  failureRate: 0.02,
};

async function simulateLatency(): Promise<void> {
  const delay = config.latency + Math.random() * 100;
  await new Promise((resolve) => setTimeout(resolve, delay));
}

async function maybeThrowError(): Promise<void> {
  if (Math.random() < config.failureRate) {
    throw new Error('Simulated network error');
  }
}

export const mockApi = {
  // Configure mock behavior
  configure: (newConfig: Partial<MockApiConfig>) => {
    Object.assign(config, newConfig);
  },

  // Snapshot
  getSnapshot: async (_timeRange: string): Promise<ScheduleSnapshot> => {
    await simulateLatency();
    await maybeThrowError();
    return getMockSnapshot();
  },

  // Assignments
  createAssignment: async (proposed: ProposedAssignment): Promise<Assignment> => {
    await simulateLatency();
    await maybeThrowError();

    const snapshot = getMockSnapshot();
    const task = snapshot.tasks.find((t) => t.id === proposed.taskId);

    if (!task) {
      throw new Error(`Task ${proposed.taskId} not found`);
    }

    const assignment: Assignment = {
      id: faker.string.uuid(),
      taskId: proposed.taskId,
      operatorId: proposed.operatorId ?? null,
      equipmentId: proposed.equipmentId ?? null,
      scheduledStart: proposed.scheduledStart,
      scheduledEnd: addMinutes(new Date(proposed.scheduledStart), task.duration).toISOString(),
    };

    updateMockSnapshot((s) => ({
      ...s,
      assignments: [...s.assignments, assignment],
      tasks: s.tasks.map((t) =>
        t.id === proposed.taskId ? { ...t, status: 'Assigned' as const } : t
      ),
    }));

    return assignment;
  },

  updateAssignment: async (id: string, updates: Partial<Assignment>): Promise<Assignment> => {
    await simulateLatency();
    await maybeThrowError();

    let updated: Assignment | undefined;

    updateMockSnapshot((s) => {
      const idx = s.assignments.findIndex((a) => a.id === id);
      if (idx === -1) throw new Error(`Assignment ${id} not found`);

      updated = { ...s.assignments[idx], ...updates };
      const newAssignments = [...s.assignments];
      newAssignments[idx] = updated;

      return { ...s, assignments: newAssignments };
    });

    return updated!;
  },

  deleteAssignment: async (id: string): Promise<void> => {
    await simulateLatency();
    await maybeThrowError();

    updateMockSnapshot((s) => {
      const assignment = s.assignments.find((a) => a.id === id);
      if (!assignment) throw new Error(`Assignment ${id} not found`);

      return {
        ...s,
        assignments: s.assignments.filter((a) => a.id !== id),
        tasks: s.tasks.map((t) =>
          t.id === assignment.taskId ? { ...t, status: 'Ready' as const } : t
        ),
      };
    });
  },

  // Operators CRUD
  getOperators: async (): Promise<Operator[]> => {
    await simulateLatency();
    await maybeThrowError();
    return getMockSnapshot().operators;
  },

  createOperator: async (data: CreateOperatorDto): Promise<Operator> => {
    await simulateLatency();
    await maybeThrowError();

    const operator: Operator = {
      id: faker.string.uuid(),
      name: data.name,
      status: 'Active',
      availability: data.availability,
      skills: data.skills,
    };

    updateMockSnapshot((s) => ({
      ...s,
      operators: [...s.operators, operator],
    }));

    return operator;
  },

  updateOperator: async (id: string, data: UpdateOperatorDto): Promise<Operator> => {
    await simulateLatency();
    await maybeThrowError();

    let updated: Operator | undefined;

    updateMockSnapshot((s) => {
      const idx = s.operators.findIndex((o) => o.id === id);
      if (idx === -1) throw new Error(`Operator ${id} not found`);

      updated = { ...s.operators[idx], ...data };
      const newOperators = [...s.operators];
      newOperators[idx] = updated;

      return { ...s, operators: newOperators };
    });

    return updated!;
  },

  deleteOperator: async (id: string): Promise<void> => {
    await simulateLatency();
    await maybeThrowError();

    updateMockSnapshot((s) => ({
      ...s,
      operators: s.operators.filter((o) => o.id !== id),
    }));
  },

  // Equipment CRUD
  getEquipment: async (): Promise<Equipment[]> => {
    await simulateLatency();
    await maybeThrowError();
    return getMockSnapshot().equipment;
  },

  createEquipment: async (data: CreateEquipmentDto): Promise<Equipment> => {
    await simulateLatency();
    await maybeThrowError();

    const equipment: Equipment = {
      id: faker.string.uuid(),
      name: data.name,
      status: 'Available',
      supportedTaskTypes: data.supportedTaskTypes,
      location: data.location,
      maintenanceWindows: [],
    };

    updateMockSnapshot((s) => ({
      ...s,
      equipment: [...s.equipment, equipment],
    }));

    return equipment;
  },

  updateEquipment: async (id: string, data: UpdateEquipmentDto): Promise<Equipment> => {
    await simulateLatency();
    await maybeThrowError();

    let updated: Equipment | undefined;

    updateMockSnapshot((s) => {
      const idx = s.equipment.findIndex((e) => e.id === id);
      if (idx === -1) throw new Error(`Equipment ${id} not found`);

      updated = { ...s.equipment[idx], ...data };
      const newEquipment = [...s.equipment];
      newEquipment[idx] = updated;

      return { ...s, equipment: newEquipment };
    });

    return updated!;
  },

  deleteEquipment: async (id: string): Promise<void> => {
    await simulateLatency();
    await maybeThrowError();

    updateMockSnapshot((s) => ({
      ...s,
      equipment: s.equipment.filter((e) => e.id !== id),
    }));
  },

  // Jobs CRUD
  getJobs: async (): Promise<Job[]> => {
    await simulateLatency();
    await maybeThrowError();
    return getMockSnapshot().jobs;
  },

  createJob: async (data: CreateJobDto): Promise<Job> => {
    await simulateLatency();
    await maybeThrowError();

    const job: Job = {
      id: faker.string.uuid(),
      name: data.name,
      description: data.description,
      deadline: data.deadline,
      status: 'Draft',
    };

    updateMockSnapshot((s) => ({
      ...s,
      jobs: [...s.jobs, job],
    }));

    return job;
  },

  updateJob: async (id: string, data: UpdateJobDto): Promise<Job> => {
    await simulateLatency();
    await maybeThrowError();

    let updated: Job | undefined;

    updateMockSnapshot((s) => {
      const idx = s.jobs.findIndex((j) => j.id === id);
      if (idx === -1) throw new Error(`Job ${id} not found`);

      updated = { ...s.jobs[idx], ...data };
      const newJobs = [...s.jobs];
      newJobs[idx] = updated;

      return { ...s, jobs: newJobs };
    });

    return updated!;
  },

  deleteJob: async (id: string): Promise<void> => {
    await simulateLatency();
    await maybeThrowError();

    updateMockSnapshot((s) => ({
      ...s,
      jobs: s.jobs.filter((j) => j.id !== id),
      tasks: s.tasks.filter((t) => t.jobId !== id),
    }));
  },

  addTaskToJob: async (jobId: string, data: CreateTaskDto): Promise<Task> => {
    await simulateLatency();
    await maybeThrowError();

    const snapshot = getMockSnapshot();
    const job = snapshot.jobs.find((j) => j.id === jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    const task: Task = {
      id: faker.string.uuid(),
      jobId,
      type: data.type,
      duration: data.duration,
      requiresOperator: data.requiresOperator,
      requiresEquipment: data.requiresEquipment,
      dependencies: data.dependencies,
      status: 'Defined',
    };

    updateMockSnapshot((s) => ({
      ...s,
      tasks: [...s.tasks, task],
    }));

    return task;
  },
};
