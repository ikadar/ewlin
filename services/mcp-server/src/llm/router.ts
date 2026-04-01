import Anthropic from '@anthropic-ai/sdk';
import { toolDefinitions, toolsByName } from './tools.js';
import { resolveModel } from './client.js';

export type Intent =
  | 'lookup'
  | 'duration'
  | 'completion'
  | 'placement'
  | 'station'
  | 'job_update'
  | 'task_ops'
  | 'prerequisite'
  | 'schedule_mgmt'
  | 'compact';

const INTENT_TOOL_MAP: Record<Intent, string[]> = {
  lookup: ['get_schedule_summary', 'lookup_station', 'search_jobs'],
  duration: ['search_jobs', 'lookup_station', 'extend_task_and_replan', 'update_task_duration'],
  completion: ['search_jobs', 'complete_tasks', 'complete_tasks_before'],
  placement: ['search_jobs', 'lookup_station', 'auto_place', 'auto_place_job_asap', 'auto_place_job_alap'],
  station: ['lookup_station', 'add_station_exception'],
  job_update: ['search_jobs', 'update_job', 'delete_job', 'set_job_dependencies', 'remove_job_dependency', 'get_job_dependencies', 'update_outsourced_task_status'],
  task_ops: ['search_jobs', 'lookup_station', 'assign_task', 'reschedule_task', 'split_task', 'fuse_task', 'unassign_tasks'],
  prerequisite: ['search_jobs', 'update_element_prerequisite'],
  schedule_mgmt: ['list_saved_schedules', 'save_schedule', 'load_schedule'],
  compact: ['smart_compact'],
};

const VALID_INTENTS = new Set<string>(Object.keys(INTENT_TOOL_MAP));

const CLASSIFICATION_PROMPT = `Classify this scheduling command into one category:
lookup,duration,completion,placement,station,job_update,task_ops,prerequisite,schedule_mgmt,compact
Reply with ONLY the category name, nothing else.`;

export interface ClassificationResult {
  intent: Intent | null;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Classify user message intent via a cheap Haiku call (no tools, ~150 tokens).
 */
export async function classifyIntent(
  message: string,
  model?: string,
): Promise<ClassificationResult> {
  const anthropic = new Anthropic();

  try {
    const response = await anthropic.messages.create({
      model: resolveModel(model),
      max_tokens: 20,
      system: CLASSIFICATION_PROMPT,
      messages: [{ role: 'user', content: message }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text.trim().toLowerCase() : '';
    const intent = VALID_INTENTS.has(text) ? (text as Intent) : null;

    return {
      intent,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  } catch {
    return { intent: null, inputTokens: 0, outputTokens: 0 };
  }
}

/**
 * Get the tool subset for a classified intent.
 * Returns all tools as fallback if intent is null.
 */
export function getToolsForIntent(intent: Intent | null): Anthropic.Tool[] {
  if (intent === null) {
    return toolDefinitions;
  }

  const toolNames = INTENT_TOOL_MAP[intent];
  const tools: Anthropic.Tool[] = [];
  for (const name of toolNames) {
    const tool = toolsByName.get(name);
    if (tool) tools.push(tool);
  }

  return tools.length > 0 ? tools : toolDefinitions;
}

