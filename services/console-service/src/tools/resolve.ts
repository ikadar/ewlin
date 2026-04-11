/**
 * Entity resolution tools.
 *
 * The LLM uses these to translate user-friendly names ("Frédéric",
 * "MBO XL", "dossier 35202") into stable UUIDs. Each resolver returns
 * a LIST of candidates (potentially empty) and lets the LLM disambiguate
 * via ask_user when there's more than one match.
 *
 * All resolvers are read-only — dry-run and wet mode are identical.
 */
import { z } from 'zod';
import type { ToolDefinition } from './types.js';

interface OperatorRow {
  id: string;
  firstName: string;
  lastName: string;
  role?: string | null;
}

interface StationRow {
  id: string;
  name: string;
  abbreviation?: string | null;
  categoryId?: string;
}

interface JobRow {
  id: string;
  reference?: string | null;
  client?: string | null;
  description?: string | null;
  batDeadline?: string | null;
  workshopExitDate?: string | null;
}

interface TaskRow {
  id: string;
  stationId: string;
  elementId?: string;
  setupMinutes: number;
  runMinutes: number;
  sequenceOrder?: number;
}

/**
 * The PHP API returns tasks at the top level of the job response
 * (`tasks: [...]`), NOT nested inside `elements[].tasks`. Elements
 * carry only `taskIds: string[]` to preserve element grouping.
 */
interface JobDetailRow extends JobRow {
  tasks?: TaskRow[];
  elements?: Array<{
    id: string;
    name?: string | null;
    taskIds?: string[];
  }>;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .trim();
}

export const resolveOperatorTool: ToolDefinition = {
  name: 'resolve_operator',
  description:
    "Recherche un opérateur par prénom, nom, ou un fragment de nom complet. Renvoie TOUS les candidats correspondants. Le LLM doit appeler ask_user si plusieurs candidats existent et que le contexte ne permet pas de trancher.",
  readOnly: true,
  inputSchema: z.object({
    name: z
      .string()
      .min(1)
      .describe(
        "Le nom ou prénom à rechercher. Recherche insensible aux accents et à la casse, sur firstName, lastName, ou la concaténation des deux.",
      ),
  }),
  handler: async (input, ctx) => {
    const operators = await ctx.php.get<OperatorRow[] | { items: OperatorRow[] }>('/api/v1/operators');
    const list = Array.isArray(operators) ? operators : operators.items ?? [];
    const needle = normalize(input.name);
    const matches = list.filter((op) => {
      const first = normalize(op.firstName ?? '');
      const last = normalize(op.lastName ?? '');
      const full = `${first} ${last}`;
      return first.includes(needle) || last.includes(needle) || full.includes(needle);
    });
    return {
      ok: true,
      data: {
        candidates: matches.map((op) => ({
          id: op.id,
          firstName: op.firstName,
          lastName: op.lastName,
          role: op.role ?? null,
          label: `${op.firstName} ${op.lastName}${op.role ? ` (${op.role})` : ''}`,
        })),
        count: matches.length,
      },
    };
  },
};

export const resolveStationTool: ToolDefinition = {
  name: 'resolve_station',
  description:
    "Recherche une station par nom ou abréviation (insensible à la casse et aux accents). Renvoie tous les candidats. Exemples : 'MBO XL', 'G40', 'Komori', 'massicot'.",
  readOnly: true,
  inputSchema: z.object({
    name: z.string().min(1).describe("Le nom ou l'abréviation de la station à rechercher."),
  }),
  handler: async (input, ctx) => {
    // Use the full station list and filter client-side. /stations may
    // return an envelope or a flat array depending on the endpoint version.
    const raw = await ctx.php.get<StationRow[] | { items: StationRow[] }>('/api/v1/stations');
    const list = Array.isArray(raw) ? raw : raw.items ?? [];
    const needle = normalize(input.name);
    const matches = list.filter((s) => {
      const name = normalize(s.name ?? '');
      const abbr = normalize(s.abbreviation ?? '');
      return name.includes(needle) || (abbr.length > 0 && abbr.includes(needle));
    });
    return {
      ok: true,
      data: {
        candidates: matches.map((s) => ({
          id: s.id,
          name: s.name,
          abbreviation: s.abbreviation ?? null,
          label: s.abbreviation ? `${s.name} (${s.abbreviation})` : s.name,
        })),
        count: matches.length,
      },
    };
  },
};

export const resolveJobTool: ToolDefinition = {
  name: 'resolve_job',
  description:
    "Recherche un job (dossier) par sa référence numérique ou textuelle. Exemples : 'dossier 35202', '12345', 'job 1234'. Renvoie tous les candidats correspondants.",
  readOnly: true,
  inputSchema: z.object({
    reference: z
      .string()
      .min(1)
      .describe("La référence du job, sans préfixe. 'dossier 35202' → '35202'."),
  }),
  handler: async (input, ctx) => {
    // Strip "dossier", "job", whitespace, and try the dedicated lookup
    // endpoint first; fall back to the generic search.
    const cleaned = input.reference.replace(/dossier|job|n[°o]/gi, '').trim();
    const tryEndpoints: string[] = [
      `/api/v1/jobs/search-by-references?refs=${encodeURIComponent(cleaned)}`,
      `/api/v1/jobs?search=${encodeURIComponent(cleaned)}`,
    ];
    let candidates: JobRow[] = [];
    const attempts: Array<{ endpoint: string; status: 'ok' | 'empty' | 'error'; error?: string; count?: number }> = [];
    for (const endpoint of tryEndpoints) {
      try {
        const raw = await ctx.php.get<JobRow[] | { items: JobRow[] }>(endpoint);
        const list = Array.isArray(raw) ? raw : raw.items ?? [];
        attempts.push({ endpoint, status: list.length > 0 ? 'ok' : 'empty', count: list.length });
        if (list.length > 0) {
          candidates = list;
          break;
        }
      } catch (err) {
        attempts.push({
          endpoint,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    // Log to stderr so it shows up in `docker compose logs console-service`.
    // Useful for debugging "the LLM said it couldn't find a job that exists".
    console.error(`[resolve_job] reference="${input.reference}" cleaned="${cleaned}" attempts=${JSON.stringify(attempts)}`);
    return {
      ok: true,
      data: {
        candidates: candidates.map((j) => ({
          id: j.id,
          reference: j.reference ?? null,
          client: j.client ?? null,
          description: j.description ?? null,
          batDeadline: j.batDeadline ?? null,
          label: `${j.reference ?? '(sans réf)'}${j.client ? ` — ${j.client}` : ''}`,
        })),
        count: candidates.length,
      },
    };
  },
};

export const resolveTaskInJobTool: ToolDefinition = {
  name: 'resolve_task_in_job',
  description:
    "Trouve la (ou les) tâche(s) d'un job qui correspondent à une station donnée. Utile pour les ordres comme 'la tâche MBO XL du job 12345' ou 'remplace la tâche MBO XL'. Si stationName est omis, retourne TOUTES les tâches du job.",
  readOnly: true,
  inputSchema: z.object({
    jobId: z.string().min(1).describe("L'UUID du job (obtenu via resolve_job)."),
    stationName: z
      .string()
      .optional()
      .describe(
        "Filtre optionnel : ne retourne que les tâches dont la station correspond à ce nom (insensible à la casse et aux accents).",
      ),
  }),
  handler: async (input, ctx) => {
    const job = await ctx.php.get<JobDetailRow>(`/api/v1/jobs/${input.jobId}`);

    // Build a taskId → elementId map so we can attach the element id back
    // even though tasks live at the top level of the job response.
    const taskToElement = new Map<string, string>();
    for (const element of job.elements ?? []) {
      for (const tid of element.taskIds ?? []) {
        taskToElement.set(tid, element.id);
      }
    }

    const allTasks: Array<{
      taskId: string;
      stationId: string;
      stationName?: string;
      setupMinutes: number;
      runMinutes: number;
      elementId: string | null;
      sequenceOrder: number | null;
    }> = (job.tasks ?? []).map((task) => ({
      taskId: task.id,
      stationId: task.stationId,
      setupMinutes: task.setupMinutes,
      runMinutes: task.runMinutes,
      elementId: taskToElement.get(task.id) ?? task.elementId ?? null,
      sequenceOrder: task.sequenceOrder ?? null,
    }));

    // Enrich with station names so the LLM can match by name
    if (allTasks.length > 0) {
      try {
        const stations = await ctx.php.get<StationRow[] | { items: StationRow[] }>('/api/v1/stations');
        const stationList = Array.isArray(stations) ? stations : stations.items ?? [];
        const byId = new Map(stationList.map((s) => [s.id, s.name]));
        for (const t of allTasks) {
          const name = byId.get(t.stationId);
          if (name) t.stationName = name;
        }
      } catch {
        // best effort enrichment
      }
    }

    let filtered = allTasks;
    if (input.stationName) {
      // Token-based match: each whitespace-separated word in the needle must
      // appear somewhere in the station name. So "Komori G40" matches both
      // "G40 Komori 540" and "Komori G40", whereas the previous strict
      // includes() failed when the user's word order didn't match exactly.
      const needleTokens = normalize(input.stationName)
        .split(/\s+/)
        .filter((t) => t.length > 0);
      filtered = allTasks.filter((t) => {
        const hay = normalize(t.stationName ?? '');
        return needleTokens.every((tok) => hay.includes(tok));
      });
    }

    console.error(
      `[resolve_task_in_job] jobId=${input.jobId} stationName=${input.stationName ?? '(none)'} ` +
        `total_tasks=${allTasks.length} matched=${filtered.length} ` +
        `available_stations=${JSON.stringify([...new Set(allTasks.map((t) => t.stationName ?? '?'))])}`,
    );

    return {
      ok: true,
      data: {
        candidates: filtered,
        count: filtered.length,
      },
    };
  },
};
