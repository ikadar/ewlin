import { PhpApiClient } from '../api/phpClient.js';

interface ToolInput {
  [key: string]: unknown;
}

/**
 * Summarize a full snapshot into a concise format for the LLM.
 */
function summarizeSnapshot(snapshot: Record<string, unknown>): Record<string, unknown> {
  const stations = (snapshot.stations as Array<Record<string, unknown>>) ?? [];
  const jobs = (snapshot.jobs as Array<Record<string, unknown>>) ?? [];
  const tasks = (snapshot.tasks as Array<Record<string, unknown>>) ?? [];
  const assignments = (snapshot.assignments as Array<Record<string, unknown>>) ?? [];
  const lateJobs = (snapshot.lateJobs as Array<Record<string, unknown>>) ?? [];

  return {
    stations: stations.map((s) => `${s.name}(${s.id})`),
    jobs: jobs.map((j) => `${j.reference}:${j.status}(${j.id})`),
    tasks: tasks.length,
    assigned: assignments.length,
    unscheduled: tasks.length - assignments.length,
    late: lateJobs.map((l) => `${l.reference}:${l.latenessMinutes}min`),
  };
}

/**
 * Execute a read-only tool against the PHP API.
 */
export async function executeReadTool(
  toolName: string,
  input: ToolInput,
  client: PhpApiClient
): Promise<Record<string, unknown>> {
  switch (toolName) {
    case 'get_schedule_summary': {
      const snapshot = await client.getSnapshot();
      return summarizeSnapshot(snapshot);
    }
    case 'lookup_station': {
      const names = await client.lookupStations(input.query as string);
      return { stations: names, count: names.length };
    }
    case 'search_jobs': {
      return await client.searchJobsByReferences(input.references as string[]);
    }
    case 'list_saved_schedules': {
      const schedules = await client.listSavedSchedules();
      return { schedules, count: schedules.length };
    }
    case 'get_job_dependencies': {
      return await client.getJobDependencies(input.jobId as string);
    }
    default:
      throw new Error(`Unknown read tool: ${toolName}`);
  }
}

/**
 * Execute a write tool against the PHP API.
 */
export async function executeWriteTool(
  toolName: string,
  input: ToolInput,
  client: PhpApiClient
): Promise<Record<string, unknown>> {
  switch (toolName) {
    case 'update_task_duration':
      return await client.updateTaskDuration(
        input.taskId as string,
        input.newRunMinutes as number
      );

    case 'add_station_exception':
      return await client.addStationException(input.stationId as string, {
        date: input.date as string,
        type: input.type as string,
        schedule: input.schedule as Record<string, unknown> | undefined,
        reason: input.reason as string | undefined,
      });

    case 'complete_tasks':
      return await client.batchComplete(input.taskIds as string[]);

    case 'complete_tasks_before':
      return await client.batchCompleteBefore(
        input.before as string,
        input.stationId as string | undefined
      );

    case 'unassign_tasks': {
      const taskIds = input.taskIds as string[];
      const results: Array<Record<string, unknown>> = [];
      for (const taskId of taskIds) {
        try {
          const result = await client.unassignTask(taskId);
          results.push({ taskId, status: 'unassigned', ...result });
        } catch (e) {
          results.push({
            taskId,
            status: 'error',
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
      return { unassignedCount: results.filter((r) => r.status === 'unassigned').length, results };
    }

    case 'auto_place':
      return await client.autoPlace();

    case 'smart_compact':
      return await client.smartCompact(input.horizonHours as number | undefined);

    case 'delete_job':
      return await client.deleteJob(input.jobId as string);

    case 'assign_task':
      return await client.assignTask(
        input.taskId as string,
        input.targetId as string,
        input.scheduledStart as string,
        input.bypassPrecedence as boolean | undefined
      );

    case 'reschedule_task':
      return await client.rescheduleTask(
        input.taskId as string,
        input.targetId as string,
        input.scheduledStart as string,
        input.bypassPrecedence as boolean | undefined
      );

    case 'split_task':
      return await client.splitTask(
        input.taskId as string,
        input.ratio as number
      );

    case 'fuse_task':
      return await client.fuseTask(input.taskId as string);

    case 'set_job_dependencies':
      return await client.setJobDependencies(
        input.jobId as string,
        input.requiredJobIds as string[]
      );

    case 'remove_job_dependency':
      return await client.removeJobDependency(
        input.jobId as string,
        input.requiredJobId as string
      );

    case 'update_element_prerequisite':
      return await client.updateElementPrerequisite(
        input.elementId as string,
        input.column as string,
        input.value as string
      );

    case 'update_job': {
      const { jobId, ...fields } = input;
      return await client.updateJob(jobId as string, fields);
    }

    case 'update_outsourced_task_status':
      return await client.updateOutsourcedTaskStatus(
        input.taskId as string,
        input.status as string
      );

    case 'save_schedule':
      return await client.saveSchedule(input.name as string);

    case 'load_schedule':
      return await client.loadSchedule(input.savedScheduleId as string);

    case 'auto_place_job_asap':
      return await client.autoPlaceJobAsap(input.jobId as string);

    case 'auto_place_job_alap':
      return await client.autoPlaceJobAlap(input.jobId as string);

    case 'extend_task_and_replan':
      return await client.extendAndReplan(
        input.taskId as string,
        input.newRunMinutes as number
      );

    default:
      throw new Error(`Unknown write tool: ${toolName}`);
  }
}
