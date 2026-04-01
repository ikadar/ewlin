import { describe, it, expect } from 'vitest';
import { toolDefinitions, READ_TOOLS, WRITE_TOOLS } from '../src/llm/tools.js';

describe('Tool definitions', () => {
  it('has 27 tools total', () => {
    expect(toolDefinitions).toHaveLength(27);
  });

  it('has 5 read tools', () => {
    expect(READ_TOOLS.size).toBe(5);
  });

  it('has 22 write tools', () => {
    expect(WRITE_TOOLS.size).toBe(22);
  });

  it('every tool definition is in exactly one set (read or write)', () => {
    for (const tool of toolDefinitions) {
      const inRead = READ_TOOLS.has(tool.name);
      const inWrite = WRITE_TOOLS.has(tool.name);
      expect(inRead || inWrite).toBe(true);
      expect(inRead && inWrite).toBe(false);
    }
  });

  it('no orphan entries in READ_TOOLS set', () => {
    const definedNames = new Set(toolDefinitions.map((t) => t.name));
    for (const name of READ_TOOLS) {
      expect(definedNames.has(name)).toBe(true);
    }
  });

  it('no orphan entries in WRITE_TOOLS set', () => {
    const definedNames = new Set(toolDefinitions.map((t) => t.name));
    for (const name of WRITE_TOOLS) {
      expect(definedNames.has(name)).toBe(true);
    }
  });

  it('all tool names are unique', () => {
    const names = toolDefinitions.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('all tools have valid input_schema', () => {
    for (const tool of toolDefinitions) {
      expect(tool.input_schema).toBeDefined();
      expect(tool.input_schema.type).toBe('object');
    }
  });

  // Verify specific new tools exist
  const expectedTools = [
    'get_schedule_summary',
    'lookup_station',
    'search_jobs',
    'list_saved_schedules',
    'get_job_dependencies',
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
  ];

  for (const name of expectedTools) {
    it(`includes tool "${name}"`, () => {
      expect(toolDefinitions.find((t) => t.name === name)).toBeDefined();
    });
  }
});
