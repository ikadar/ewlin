import { describe, it, expect } from 'vitest';
import { getToolsForIntent, type Intent } from '../src/llm/router.js';
import { toolDefinitions } from '../src/llm/tools.js';

const ALL_INTENTS: Intent[] = [
  'lookup', 'duration', 'completion', 'placement', 'station',
  'job_update', 'task_ops', 'prerequisite', 'schedule_mgmt', 'compact',
];

describe('getToolsForIntent', () => {
  it('returns all tools for null intent (fallback)', () => {
    const tools = getToolsForIntent(null);
    expect(tools).toHaveLength(toolDefinitions.length);
  });

  for (const intent of ALL_INTENTS) {
    it(`returns non-empty subset for "${intent}"`, () => {
      const tools = getToolsForIntent(intent);
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.length).toBeLessThanOrEqual(toolDefinitions.length);
    });
  }

  it('every tool is reachable from at least one intent', () => {
    const reachable = new Set<string>();
    for (const intent of ALL_INTENTS) {
      for (const tool of getToolsForIntent(intent)) {
        reachable.add(tool.name);
      }
    }
    for (const tool of toolDefinitions) {
      expect(reachable.has(tool.name)).toBe(true);
    }
  });

  it('intent subsets are much smaller than full set', () => {
    let totalTools = 0;
    for (const intent of ALL_INTENTS) {
      totalTools += getToolsForIntent(intent).length;
    }
    const avgTools = totalTools / ALL_INTENTS.length;
    // Average should be well under half the total
    expect(avgTools).toBeLessThan(toolDefinitions.length / 2);
  });

  it('lookup intent includes search_jobs and lookup_station', () => {
    const names = getToolsForIntent('lookup').map((t) => t.name);
    expect(names).toContain('search_jobs');
    expect(names).toContain('lookup_station');
  });

  it('duration intent includes extend_task_and_replan', () => {
    const names = getToolsForIntent('duration').map((t) => t.name);
    expect(names).toContain('extend_task_and_replan');
  });

  it('completion intent includes complete_tasks', () => {
    const names = getToolsForIntent('completion').map((t) => t.name);
    expect(names).toContain('complete_tasks');
  });
});
