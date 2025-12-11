import { faker } from '@faker-js/faker';
import { addMinutes } from 'date-fns';
import type {
  ScheduleSnapshot,
  Assignment,
  Station,
  StationCategory,
  StationGroup,
  OutsourcedProvider,
  Job,
  Task,
  ProposedAssignment,
  ValidationResult,
  CreateStationDto,
  UpdateStationDto,
  CreateStationCategoryDto,
  UpdateStationCategoryDto,
  CreateStationGroupDto,
  UpdateStationGroupDto,
  CreateProviderDto,
  UpdateProviderDto,
  CreateJobDto,
  UpdateJobDto,
  CreateScheduleExceptionDto,
  ScheduleException,
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

    // Find the task within jobs
    let task: Task | undefined;
    let job: Job | undefined;
    for (const j of snapshot.jobs) {
      const t = j.tasks.find((t) => t.id === proposed.taskId);
      if (t) {
        task = t;
        job = j;
        break;
      }
    }

    if (!task || !job) {
      throw new Error(`Task ${proposed.taskId} not found`);
    }

    const duration = task.type === 'internal' ? task.totalMinutes : (task.durationOpenDays || 1) * 24 * 60;

    const assignment: Assignment = {
      id: faker.string.uuid(),
      taskId: proposed.taskId,
      jobId: job.id,
      stationId: proposed.stationId,
      scheduledStart: proposed.scheduledStart,
      scheduledEnd: addMinutes(new Date(proposed.scheduledStart), duration).toISOString(),
    };

    updateMockSnapshot((s) => ({
      ...s,
      assignments: [...s.assignments, assignment],
      jobs: s.jobs.map((j) =>
        j.id === job!.id
          ? {
              ...j,
              tasks: j.tasks.map((t) =>
                t.id === proposed.taskId ? { ...t, status: 'Assigned' as const } : t
              ),
            }
          : j
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
        jobs: s.jobs.map((j) =>
          j.id === assignment.jobId
            ? {
                ...j,
                tasks: j.tasks.map((t) =>
                  t.id === assignment.taskId ? { ...t, status: 'Ready' as const } : t
                ),
              }
            : j
        ),
      };
    });
  },

  validateAssignment: async (proposed: ProposedAssignment): Promise<ValidationResult> => {
    await simulateLatency();
    await maybeThrowError();

    // Simple mock validation - always returns valid
    return {
      valid: true,
      conflicts: [],
      warnings: [],
    };
  },

  // Stations CRUD
  getStations: async (): Promise<Station[]> => {
    await simulateLatency();
    await maybeThrowError();
    return getMockSnapshot().stations;
  },

  createStation: async (data: CreateStationDto): Promise<Station> => {
    await simulateLatency();
    await maybeThrowError();

    const station: Station = {
      id: faker.string.uuid(),
      name: data.name,
      categoryId: data.categoryId,
      groupId: data.groupId,
      capacity: data.capacity,
      status: 'Available',
      operatingSchedule: data.operatingSchedule,
      exceptions: [],
    };

    updateMockSnapshot((s) => ({
      ...s,
      stations: [...s.stations, station],
    }));

    return station;
  },

  updateStation: async (id: string, data: UpdateStationDto): Promise<Station> => {
    await simulateLatency();
    await maybeThrowError();

    let updated: Station | undefined;

    updateMockSnapshot((s) => {
      const idx = s.stations.findIndex((st) => st.id === id);
      if (idx === -1) throw new Error(`Station ${id} not found`);

      updated = { ...s.stations[idx], ...data };
      const newStations = [...s.stations];
      newStations[idx] = updated;

      return { ...s, stations: newStations };
    });

    return updated!;
  },

  deleteStation: async (id: string): Promise<void> => {
    await simulateLatency();
    await maybeThrowError();

    updateMockSnapshot((s) => ({
      ...s,
      stations: s.stations.filter((st) => st.id !== id),
    }));
  },

  addScheduleException: async (data: CreateScheduleExceptionDto): Promise<ScheduleException> => {
    await simulateLatency();
    await maybeThrowError();

    const exception: ScheduleException = {
      id: faker.string.uuid(),
      stationId: data.stationId,
      date: data.date,
      type: data.type,
      reason: data.reason,
      modifiedSlots: data.modifiedSlots,
    };

    updateMockSnapshot((s) => ({
      ...s,
      stations: s.stations.map((st) =>
        st.id === data.stationId
          ? { ...st, exceptions: [...st.exceptions, exception] }
          : st
      ),
    }));

    return exception;
  },

  // Station Categories CRUD
  getCategories: async (): Promise<StationCategory[]> => {
    await simulateLatency();
    await maybeThrowError();
    return getMockSnapshot().categories;
  },

  createCategory: async (data: CreateStationCategoryDto): Promise<StationCategory> => {
    await simulateLatency();
    await maybeThrowError();

    const category: StationCategory = {
      id: faker.string.uuid(),
      name: data.name,
      similarityCriteria: data.similarityCriteria,
    };

    updateMockSnapshot((s) => ({
      ...s,
      categories: [...s.categories, category],
    }));

    return category;
  },

  updateCategory: async (id: string, data: UpdateStationCategoryDto): Promise<StationCategory> => {
    await simulateLatency();
    await maybeThrowError();

    let updated: StationCategory | undefined;

    updateMockSnapshot((s) => {
      const idx = s.categories.findIndex((c) => c.id === id);
      if (idx === -1) throw new Error(`Category ${id} not found`);

      updated = { ...s.categories[idx], ...data };
      const newCategories = [...s.categories];
      newCategories[idx] = updated;

      return { ...s, categories: newCategories };
    });

    return updated!;
  },

  deleteCategory: async (id: string): Promise<void> => {
    await simulateLatency();
    await maybeThrowError();

    updateMockSnapshot((s) => ({
      ...s,
      categories: s.categories.filter((c) => c.id !== id),
    }));
  },

  // Station Groups CRUD
  getGroups: async (): Promise<StationGroup[]> => {
    await simulateLatency();
    await maybeThrowError();
    return getMockSnapshot().groups;
  },

  createGroup: async (data: CreateStationGroupDto): Promise<StationGroup> => {
    await simulateLatency();
    await maybeThrowError();

    const group: StationGroup = {
      id: faker.string.uuid(),
      name: data.name,
      maxConcurrent: data.maxConcurrent,
      isOutsourcedProviderGroup: false,
    };

    updateMockSnapshot((s) => ({
      ...s,
      groups: [...s.groups, group],
    }));

    return group;
  },

  updateGroup: async (id: string, data: UpdateStationGroupDto): Promise<StationGroup> => {
    await simulateLatency();
    await maybeThrowError();

    let updated: StationGroup | undefined;

    updateMockSnapshot((s) => {
      const idx = s.groups.findIndex((g) => g.id === id);
      if (idx === -1) throw new Error(`Group ${id} not found`);

      updated = { ...s.groups[idx], ...data };
      const newGroups = [...s.groups];
      newGroups[idx] = updated;

      return { ...s, groups: newGroups };
    });

    return updated!;
  },

  deleteGroup: async (id: string): Promise<void> => {
    await simulateLatency();
    await maybeThrowError();

    updateMockSnapshot((s) => ({
      ...s,
      groups: s.groups.filter((g) => g.id !== id),
    }));
  },

  // Providers CRUD
  getProviders: async (): Promise<OutsourcedProvider[]> => {
    await simulateLatency();
    await maybeThrowError();
    return getMockSnapshot().providers;
  },

  createProvider: async (data: CreateProviderDto): Promise<OutsourcedProvider> => {
    await simulateLatency();
    await maybeThrowError();

    const groupId = `grp-prov-${faker.string.alphanumeric(8)}`;

    // Create provider group
    const providerGroup: StationGroup = {
      id: groupId,
      name: `${data.name} (Provider)`,
      maxConcurrent: null,
      isOutsourcedProviderGroup: true,
    };

    const provider: OutsourcedProvider = {
      id: faker.string.uuid(),
      name: data.name,
      supportedActionTypes: data.supportedActionTypes,
      groupId,
      status: 'Active',
    };

    updateMockSnapshot((s) => ({
      ...s,
      providers: [...s.providers, provider],
      groups: [...s.groups, providerGroup],
    }));

    return provider;
  },

  updateProvider: async (id: string, data: UpdateProviderDto): Promise<OutsourcedProvider> => {
    await simulateLatency();
    await maybeThrowError();

    let updated: OutsourcedProvider | undefined;

    updateMockSnapshot((s) => {
      const idx = s.providers.findIndex((p) => p.id === id);
      if (idx === -1) throw new Error(`Provider ${id} not found`);

      updated = { ...s.providers[idx], ...data };
      const newProviders = [...s.providers];
      newProviders[idx] = updated;

      return { ...s, providers: newProviders };
    });

    return updated!;
  },

  deleteProvider: async (id: string): Promise<void> => {
    await simulateLatency();
    await maybeThrowError();

    updateMockSnapshot((s) => {
      const provider = s.providers.find((p) => p.id === id);
      return {
        ...s,
        providers: s.providers.filter((p) => p.id !== id),
        groups: provider ? s.groups.filter((g) => g.id !== provider.groupId) : s.groups,
      };
    });
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
      reference: data.reference,
      client: data.client,
      description: data.description,
      workshopExitDate: data.workshopExitDate,
      status: 'Draft',
      fullyScheduled: false,
      color: faker.helpers.arrayElement(['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']),
      paperType: data.paperType || null,
      paperFormat: data.paperFormat || null,
      paperPurchaseStatus: data.paperPurchaseStatus || 'InStock',
      paperOrderedAt: null,
      proofSentAt: null,
      proofApprovedAt: null,
      platesStatus: 'Todo',
      notes: data.notes || '',
      comments: [],
      dependencies: [],
      tasks: [], // Tasks would be parsed from DSL if provided
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
      assignments: s.assignments.filter((a) => a.jobId !== id),
    }));
  },
};
