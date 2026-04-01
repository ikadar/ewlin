import type Anthropic from '@anthropic-ai/sdk';

export const READ_TOOLS = new Set([
  'get_schedule_summary',
  'lookup_station',
  'search_jobs',
  'list_saved_schedules',
  'get_job_dependencies',
]);

export const WRITE_TOOLS = new Set([
  'update_task_duration',
  'add_station_exception',
  'complete_tasks',
  'complete_tasks_before',
  'unassign_tasks',
  'auto_place',
  'smart_compact',
  'delete_job',
  'assign_task',
  'reschedule_task',
  'split_task',
  'fuse_task',
  'set_job_dependencies',
  'remove_job_dependency',
  'update_element_prerequisite',
  'update_job',
  'update_outsourced_task_status',
  'save_schedule',
  'load_schedule',
  'auto_place_job_asap',
  'auto_place_job_alap',
  'extend_task_and_replan',
]);

/** Helper to build a tool def concisely */
function tool(
  name: string,
  description: string,
  properties: Record<string, unknown> = {},
  required: string[] = []
): Anthropic.Tool {
  return {
    name,
    description,
    input_schema: { type: 'object' as const, properties, required },
  };
}

const str = (d: string) => ({ type: 'string', description: d });
const num = (d: string) => ({ type: 'number', description: d });
const strArr = (d: string) => ({ type: 'array', items: { type: 'string' }, description: d });

/** Lookup map for quick access by tool name. Built after toolDefinitions. */
export let toolsByName: Map<string, Anthropic.Tool>;

export const toolDefinitions: Anthropic.Tool[] = [
  // READ
  tool('get_schedule_summary', 'Get schedule overview: stations, jobs, task counts, late jobs'),
  tool('lookup_station', 'Find station by name, returns UUID', { query: str('name or partial') }, ['query']),
  tool('search_jobs', 'Find jobs by references, returns full details with tasks', { references: strArr('job reference numbers') }, ['references']),
  tool('list_saved_schedules', 'List saved schedule snapshots with IDs and names'),
  tool('get_job_dependencies', 'Get required jobs for a job', { jobId: str('job UUID') }, ['jobId']),

  // WRITE
  tool('extend_task_and_replan', 'PREFERRED for duration changes. Updates duration, unassigns impacted tasks (same station + precedence), re-places via ASAP, reports late jobs', {
    taskId: str('task UUID'), newRunMinutes: num('new total run minutes'),
  }, ['taskId', 'newRunMinutes']),

  tool('update_task_duration', 'Change task run minutes (no replan)', {
    taskId: str('task UUID'), newRunMinutes: num('minutes'),
  }, ['taskId', 'newRunMinutes']),

  tool('add_station_exception', 'Add maintenance/closure for a station on a date', {
    stationId: str('station UUID'), date: str('YYYY-MM-DD'), type: { type: 'string', enum: ['CLOSED', 'MODIFIED'] },
    schedule: { type: 'object', properties: { isOperating: { type: 'boolean' }, slots: { type: 'array', items: { type: 'object', properties: { start: str('HH:MM'), end: str('HH:MM') }, required: ['start', 'end'] } } } },
    reason: str('optional reason'),
  }, ['stationId', 'date', 'type']),

  tool('complete_tasks', 'Mark tasks completed by IDs', { taskIds: strArr('task UUIDs') }, ['taskIds']),
  tool('complete_tasks_before', 'Complete all tasks ending before a time', {
    before: str('ISO 8601 cutoff'), stationId: str('optional station UUID'),
  }, ['before']),

  tool('unassign_tasks', 'Remove tasks from schedule for re-placement', { taskIds: strArr('task UUIDs') }, ['taskIds']),
  tool('auto_place', 'Auto-place ALL unscheduled tasks globally (ASAP)'),
  tool('smart_compact', 'Compact schedule by similarity clustering', { horizonHours: num('hours, default 24') }),

  tool('delete_job', 'Permanently delete a job', { jobId: str('job UUID') }, ['jobId']),
  tool('assign_task', 'Assign task to station at specific time', {
    taskId: str('task UUID'), targetId: str('station UUID'), scheduledStart: str('ISO 8601'),
    bypassPrecedence: { type: 'boolean', description: 'skip precedence check' },
  }, ['taskId', 'targetId', 'scheduledStart']),

  tool('reschedule_task', 'Move assigned task to new time/station', {
    taskId: str('task UUID'), targetId: str('station UUID'), scheduledStart: str('ISO 8601'),
    bypassPrecedence: { type: 'boolean', description: 'skip precedence check' },
  }, ['taskId', 'targetId', 'scheduledStart']),

  tool('split_task', 'Split task into two parts', {
    taskId: str('task UUID'), ratio: num('Part A ratio 0.05-0.95'),
  }, ['taskId', 'ratio']),

  tool('fuse_task', 'Merge split parts back into one', { taskId: str('any part UUID') }, ['taskId']),

  tool('set_job_dependencies', 'Set required jobs (replaces existing)', {
    jobId: str('dependent job UUID'), requiredJobIds: strArr('required job UUIDs'),
  }, ['jobId', 'requiredJobIds']),

  tool('remove_job_dependency', 'Remove one dependency', {
    jobId: str('job UUID'), requiredJobId: str('required job UUID'),
  }, ['jobId', 'requiredJobId']),

  tool('update_element_prerequisite', 'Update BAT/paper/plates/formes status', {
    elementId: str('element UUID'),
    column: { type: 'string', enum: ['bat', 'papier', 'formes', 'plaques'] },
    value: str('status value'),
  }, ['elementId', 'column', 'value']),

  tool('update_job', 'Update job deadline, shipper, or status', {
    jobId: str('job UUID'), workshopExitDate: str('ISO 8601'), shipperId: str('shipper UUID'),
    status: { type: 'string', enum: ['draft', 'planned', 'in_progress', 'delayed', 'completed', 'cancelled'] },
  }, ['jobId']),

  tool('update_outsourced_task_status', 'Set outsourced task stage', {
    taskId: str('task UUID'), status: { type: 'string', enum: ['pending', 'progress', 'done'] },
  }, ['taskId', 'status']),

  tool('save_schedule', 'Save current schedule snapshot', { name: str('snapshot name') }, ['name']),
  tool('load_schedule', 'Load saved schedule (replaces current)', { savedScheduleId: str('saved schedule UUID') }, ['savedScheduleId']),

  tool('auto_place_job_asap', 'ASAP auto-place for single job', { jobId: str('job UUID') }, ['jobId']),
  tool('auto_place_job_alap', 'ALAP (deadline-aware) auto-place for single job', { jobId: str('job UUID') }, ['jobId']),
];

// Build lookup map
toolsByName = new Map(toolDefinitions.map((t) => [t.name, t]));
