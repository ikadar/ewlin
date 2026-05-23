import type { APIRequestContext, Page } from '@playwright/test';
import { request } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const API_BASE = 'http://localhost:8080/api/v1';
const TEST_USER_EMAIL = 'admin@flux.local';
const TEST_USER_PASSWORD = 'TestPassword123!';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const RESULTS_FILE = path.join(REPO_ROOT, 'docs/qa/qa-mindmap-results-2026-05-09.md');
const IDS_CACHE_FILE = path.join(__dirname, '..', '.qa-mindmap-ids.json');
const SCREENSHOTS_DIR = path.join(__dirname, '..', '..', 'test-results', 'qa-mindmap');

let _ctx: APIRequestContext | null = null;
let _token: string | null = null;

export interface ApiOpts {
  scenario?: 'prod' | 'preprod';
  body?: unknown;
}

export async function getApiContext(): Promise<APIRequestContext> {
  if (_ctx) return _ctx;
  _ctx = await request.newContext();
  return _ctx;
}

export async function apiLogin(): Promise<string> {
  if (_token) return _token;
  const ctx = await getApiContext();
  const resp = await ctx.post(`${API_BASE}/auth/login`, {
    data: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
  });
  if (!resp.ok()) {
    throw new Error(`Login failed: ${resp.status()} ${await resp.text()}`);
  }
  const { token } = await resp.json();
  _token = token;
  return token;
}

export async function apiCall<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  pathname: string,
  opts: ApiOpts = {},
): Promise<T> {
  const token = await apiLogin();
  const ctx = await getApiContext();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (opts.scenario) headers['X-Flux-Scenario'] = opts.scenario;

  const url = pathname.startsWith('http') ? pathname : `${API_BASE}${pathname}`;
  const resp = await ctx.fetch(url, {
    method,
    headers,
    data: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await resp.text();
  if (!resp.ok()) {
    throw new Error(`${method} ${pathname} → ${resp.status()}: ${text}`);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export async function apiWipeJobs(): Promise<void> {
  await apiCall('POST', '/job-test/wipe');
}

export interface CreateJobPayload {
  reference: string;
  client: string;
  description: string;
  quantity: number;
  workshopExitDate?: string;
  deadlineRelativeWorkingDays?: number;
  batDeadline?: string;
  deadlinePriority?: number;
  elements?: Array<{
    name: string;
    label?: string;
    sequence?: string;
    prerequisiteNames?: string[];
    needsBat?: boolean;
    needsPaper?: boolean;
    needsForme?: boolean;
    needsPlates?: boolean;
  }>;
  tasksDsl?: string;
}

export async function apiCreateJob(payload: CreateJobPayload): Promise<{ id: string; reference: string }> {
  return apiCall<{ id: string; reference: string }>('POST', '/jobs', { body: payload });
}

export async function apiGetJobByReference(reference: string): Promise<{ id: string } | null> {
  const result = await apiCall<{ items: Array<{ id: string; reference: string }> }>(
    'GET',
    `/jobs?search=${encodeURIComponent(reference)}&limit=10`,
  );
  return result.items?.find((j) => j.reference === reference) ?? null;
}

export async function apiUpdateElementPrerequisites(
  elementId: string,
  gates: Partial<{
    paperStatus: string;
    batStatus: string;
    plateStatus: string;
    formeStatus: string;
  }>,
): Promise<void> {
  await apiCall('PUT', `/elements/${elementId}/prerequisites`, { body: gates });
}

export interface RecipePayload {
  baseJobId: string;
  quantity?: number | null;
  workshopExitDate?: string | null;
  deadlineRelativeWorkingDays?: number | null;
  batDeadline?: string | null;
  deadlinePriority?: number;
}

export interface Recipe {
  id: string;
  baseJobId: string;
  baseJobReference?: string;
}

export async function apiCreateRecipe(payload: RecipePayload): Promise<Recipe> {
  return apiCall<Recipe>('POST', '/job-test/recipes', { body: payload });
}

export async function apiListRecipes(): Promise<{ items: Recipe[] }> {
  return apiCall<{ items: Recipe[] }>('GET', '/job-test/recipes');
}

export interface ScenarioPayload {
  name: string;
  description?: string;
  items: Array<{ recipeId: string; count: number }>;
}

export interface Scenario {
  id: string;
  name: string;
}

export async function apiCreateScenario(payload: ScenarioPayload): Promise<Scenario> {
  return apiCall<Scenario>('POST', '/job-test/scenarios', { body: payload });
}

export async function apiListScenarios(): Promise<{ items: Scenario[] }> {
  return apiCall<{ items: Scenario[] }>('GET', '/job-test/scenarios');
}

export interface ExecuteScenarioResponse {
  jobs: Array<{ id: string; reference: string }>;
}

export async function apiExecuteScenario(scenarioId: string): Promise<ExecuteScenarioResponse> {
  return apiCall<ExecuteScenarioResponse>('POST', `/job-test/scenarios/${scenarioId}/execute`);
}

export async function apiSetNowOverride(virtualNow: string | null, enabled: boolean): Promise<void> {
  await apiCall('PUT', '/now-override', { body: { virtualNow, enabled } });
}

export async function apiClearNowOverride(): Promise<void> {
  await apiCall('PUT', '/now-override', { body: { enabled: false } });
}

export interface ScheduleSnapshot {
  assignments?: Array<{
    id: string;
    jobId: string;
    taskId: string;
    elementId: string;
    stationId: string;
    operatorId?: string;
    scheduledStart: string;
    scheduledEnd: string;
    setupMinutes?: number;
    runMinutes?: number;
    pinned?: boolean;
    isInProgress?: boolean;
  }>;
  outsourcedAssignments?: unknown[];
  jobs?: Array<{
    id: string;
    reference: string;
    deadlinePriority?: number;
    elements?: Array<{
      id: string;
      name: string;
      paperStatus?: string;
      batStatus?: string;
      plateStatus?: string;
      formeStatus?: string;
    }>;
  }>;
  [key: string]: unknown;
}

export async function apiGetSnapshot(scenario: 'prod' | 'preprod' = 'preprod'): Promise<ScheduleSnapshot> {
  return apiCall<ScheduleSnapshot>('GET', '/schedule/snapshot', { scenario });
}

export async function apiTriggerCompute(scenario: 'prod' | 'preprod' = 'preprod'): Promise<unknown> {
  return apiCall('POST', '/schedule/compute', { scenario, body: { strategy: 'asap' } });
}

export async function apiBatchPin(taskIds: string[], pinned: boolean): Promise<void> {
  await apiCall('PUT', '/tasks/batch-pin', { body: { taskIds, pinned } });
}

export async function apiTogglePin(taskId: string, pinAtTime?: string): Promise<void> {
  await apiCall('PUT', `/tasks/${taskId}/pin`, { body: pinAtTime ? { pinAtTime } : {} });
}

export async function apiUnpinAll(scenario: 'prod' | 'preprod' = 'preprod'): Promise<void> {
  const snap = await apiGetSnapshot(scenario);
  const pinnedIds = (snap.assignments ?? []).filter((a) => a.pinned).map((a) => a.taskId);
  if (pinnedIds.length > 0) {
    await apiBatchPin(pinnedIds, false);
  }
}

export async function apiSubmitProgressCapture(
  taskId: string,
  payload: { recordedProgressPct?: number; recordedAt?: string; productivityRatio?: number },
): Promise<unknown> {
  return apiCall('POST', `/scenarios/prod/saisie/${taskId}`, { body: payload });
}

export async function apiPinAtTime(taskId: string, at: string): Promise<unknown> {
  return apiCall('POST', `/scenarios/prod/pin/${taskId}`, { body: { at } });
}

export async function apiUpdateJob(jobId: string, payload: Record<string, unknown>): Promise<unknown> {
  return apiCall('PUT', `/jobs/${jobId}`, { body: payload });
}

interface IdsCache {
  baseJobs: Record<string, string>;
  recipes: Record<string, string>;
  scenarios: Record<string, string>;
}

const EMPTY_CACHE: IdsCache = { baseJobs: {}, recipes: {}, scenarios: {} };

export async function loadIdsCache(): Promise<IdsCache> {
  try {
    const text = await fs.readFile(IDS_CACHE_FILE, 'utf-8');
    return { ...EMPTY_CACHE, ...JSON.parse(text) };
  } catch {
    return { ...EMPTY_CACHE };
  }
}

export async function saveIdsCache(cache: IdsCache): Promise<void> {
  await fs.mkdir(path.dirname(IDS_CACHE_FILE), { recursive: true });
  await fs.writeFile(IDS_CACHE_FILE, JSON.stringify(cache, null, 2));
}

const VANILLA_SEQUENCE = '[Heidelberg] 30+60';
const MULTI_SEQUENCE_INT = '[Heidelberg] 30+120';
const MULTI_SEQUENCE_ST = 'ST [Plieuse] 60';

export async function ensureBaseJobs(): Promise<{ vanillaId: string; multiTaskId: string }> {
  const cache = await loadIdsCache();

  const vanillaRef = 'JB-VANILLA-QA';
  const multiRef = 'JB-MULTI-TASK-QA';

  let vanillaId = cache.baseJobs[vanillaRef];
  if (vanillaId) {
    const found = await apiGetJobByReference(vanillaRef);
    if (!found) vanillaId = '';
  }
  if (!vanillaId) {
    const existing = await apiGetJobByReference(vanillaRef);
    if (existing) {
      vanillaId = existing.id;
    } else {
      const created = await apiCreateJob({
        reference: vanillaRef,
        client: 'QA Mindmap',
        description: 'Job de base vanille — 1 element interne, gates None',
        quantity: 1000,
        deadlineRelativeWorkingDays: 5,
        deadlinePriority: 2,
        elements: [
          {
            name: 'INT',
            label: 'Intérieur vanille',
            sequence: VANILLA_SEQUENCE,
            needsBat: false,
            needsPaper: false,
            needsForme: false,
            needsPlates: false,
          },
        ],
      });
      vanillaId = created.id;
    }
    cache.baseJobs[vanillaRef] = vanillaId;
  }

  let multiTaskId = cache.baseJobs[multiRef];
  if (multiTaskId) {
    const found = await apiGetJobByReference(multiRef);
    if (!found) multiTaskId = '';
  }
  if (!multiTaskId) {
    const existing = await apiGetJobByReference(multiRef);
    if (existing) {
      multiTaskId = existing.id;
    } else {
      const created = await apiCreateJob({
        reference: multiRef,
        client: 'QA Mindmap',
        description: 'Job multi-task: interne 30+120 puis ST plieuse 60',
        quantity: 1000,
        deadlineRelativeWorkingDays: 5,
        deadlinePriority: 2,
        elements: [
          {
            name: 'INT',
            label: 'Intérieur',
            sequence: MULTI_SEQUENCE_INT,
            needsBat: false,
            needsPaper: false,
          },
          {
            name: 'PLI',
            label: 'Pliage ST',
            sequence: MULTI_SEQUENCE_ST,
            prerequisiteNames: ['INT'],
          },
        ],
      });
      multiTaskId = created.id;
    }
    cache.baseJobs[multiRef] = multiTaskId;
  }

  await saveIdsCache(cache);
  return { vanillaId, multiTaskId };
}

export async function ensureRecipesAndScenarios(baseJobs: {
  vanillaId: string;
  multiTaskId: string;
}): Promise<{ recipes: Record<string, string>; scenarios: Record<string, string> }> {
  const cache = await loadIdsCache();
  const existingRecipes = await apiListRecipes();
  const existingScenarios = await apiListScenarios();

  async function ensureRecipe(slug: string, payload: RecipePayload): Promise<string> {
    if (cache.recipes[slug] && existingRecipes.items.some((r) => r.id === cache.recipes[slug])) {
      return cache.recipes[slug];
    }
    const created = await apiCreateRecipe(payload);
    cache.recipes[slug] = created.id;
    return created.id;
  }

  const rVanilla = await ensureRecipe('R-vanilla', {
    baseJobId: baseJobs.vanillaId,
    deadlineRelativeWorkingDays: 5,
    deadlinePriority: 2,
  });
  const rBatJ3 = await ensureRecipe('R-bat-deadline-J3', {
    baseJobId: baseJobs.vanillaId,
    deadlineRelativeWorkingDays: 5,
    deadlinePriority: 1,
  });
  const rPaperAM = await ensureRecipe('R-paper-AM', {
    baseJobId: baseJobs.vanillaId,
    deadlineRelativeWorkingDays: 5,
    deadlinePriority: 2,
  });
  const rPaperPM = await ensureRecipe('R-paper-PM', {
    baseJobId: baseJobs.vanillaId,
    deadlineRelativeWorkingDays: 5,
    deadlinePriority: 2,
  });
  const rPlate = await ensureRecipe('R-plate-pending', {
    baseJobId: baseJobs.vanillaId,
    deadlineRelativeWorkingDays: 5,
    deadlinePriority: 2,
  });
  const rInProgress = await ensureRecipe('R-in-progress-candidate', {
    baseJobId: baseJobs.vanillaId,
    deadlineRelativeWorkingDays: 1,
    deadlinePriority: 0,
  });
  const rMulti = await ensureRecipe('R-multi-task-chain', {
    baseJobId: baseJobs.multiTaskId,
    deadlineRelativeWorkingDays: 5,
    deadlinePriority: 2,
  });

  async function ensureScenario(slug: string, payload: ScenarioPayload): Promise<string> {
    if (cache.scenarios[slug] && existingScenarios.items.some((s) => s.id === cache.scenarios[slug])) {
      return cache.scenarios[slug];
    }
    const created = await apiCreateScenario(payload);
    cache.scenarios[slug] = created.id;
    return created.id;
  }

  const sGates = await ensureScenario('S-gates', {
    name: 'S-gates (QA mindmap)',
    items: [
      { recipeId: rBatJ3, count: 1 },
      { recipeId: rPaperAM, count: 1 },
      { recipeId: rPaperPM, count: 1 },
      { recipeId: rPlate, count: 1 },
      { recipeId: rVanilla, count: 3 },
    ],
  });
  const sReplacement = await ensureScenario('S-replacement', {
    name: 'S-replacement (QA mindmap)',
    items: [
      { recipeId: rInProgress, count: 1 },
      { recipeId: rVanilla, count: 2 },
      { recipeId: rMulti, count: 1 },
    ],
  });
  const sProdMutation = await ensureScenario('S-prod-mutation', {
    name: 'S-prod-mutation (QA mindmap)',
    items: [
      { recipeId: rBatJ3, count: 1 },
      { recipeId: rPaperAM, count: 1 },
      { recipeId: rMulti, count: 1 },
    ],
  });
  const sProductivity = await ensureScenario('S-productivity (QA mindmap)' as 'S-productivity', {
    name: 'S-productivity (QA mindmap)',
    items: [
      { recipeId: rMulti, count: 1 },
      { recipeId: rVanilla, count: 2 },
    ],
  });

  await saveIdsCache(cache);

  return {
    recipes: {
      'R-vanilla': rVanilla,
      'R-bat-deadline-J3': rBatJ3,
      'R-paper-AM': rPaperAM,
      'R-paper-PM': rPaperPM,
      'R-plate-pending': rPlate,
      'R-in-progress-candidate': rInProgress,
      'R-multi-task-chain': rMulti,
    },
    scenarios: {
      'S-gates': sGates,
      'S-replacement': sReplacement,
      'S-prod-mutation': sProdMutation,
      'S-productivity': sProductivity,
    },
  };
}

export async function patchGatesByRecipe(
  generatedJobs: Array<{ id: string; reference: string }>,
  jobToGates: Record<string, Partial<{ paperStatus: string; batStatus: string; plateStatus: string; formeStatus: string }>>,
): Promise<void> {
  for (const [refSubstring, gates] of Object.entries(jobToGates)) {
    const match = generatedJobs.find((j) => j.reference.includes(refSubstring));
    if (!match) continue;
    const detail = await apiCall<{ elements: Array<{ id: string }> }>('GET', `/jobs/${match.id}`);
    for (const el of detail.elements ?? []) {
      await apiUpdateElementPrerequisites(el.id, gates);
    }
  }
}

export async function screenshotStep(page: Page, testId: string, label: string): Promise<string> {
  const dir = path.join(SCREENSHOTS_DIR, testId);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${label}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return path.relative(REPO_ROOT, file);
}

export interface TestResult {
  testId: string;
  title: string;
  status: 'OK' | 'KO' | 'PARTIAL';
  durationMs?: number;
  observation: string;
  expected?: string;
  actual?: string;
  screenshots?: string[];
}

export async function logResult(result: TestResult): Promise<void> {
  await fs.mkdir(path.dirname(RESULTS_FILE), { recursive: true });
  const exists = await fs
    .stat(RESULTS_FILE)
    .then(() => true)
    .catch(() => false);
  if (!exists) {
    await fs.writeFile(
      RESULTS_FILE,
      `# QA Mindmap — Résultats 2026-05-09\n\nGénéré par \`qa-mindmap-2026-05-09.spec.ts\`. Mis à jour au fil de l'eau (append).\n\n## Détail par test\n\n`,
    );
  }
  const block = [
    `### ${result.testId} — ${result.title}`,
    ``,
    `- **Status** : ${result.status}`,
    result.durationMs !== undefined ? `- **Durée** : ${(result.durationMs / 1000).toFixed(1)}s` : null,
    result.expected ? `- **Attendu** : ${result.expected}` : null,
    result.actual ? `- **Observé** : ${result.actual}` : null,
    `- **Observation** : ${result.observation}`,
    result.screenshots && result.screenshots.length
      ? `- **Screenshots** : ${result.screenshots.map((s) => `\`${s}\``).join(', ')}`
      : null,
    ``,
  ]
    .filter((l) => l !== null)
    .join('\n');
  await fs.appendFile(RESULTS_FILE, block + '\n');
}

export async function resetResultsFile(): Promise<void> {
  await fs.mkdir(path.dirname(RESULTS_FILE), { recursive: true });
  await fs.writeFile(
    RESULTS_FILE,
    `# QA Mindmap — Résultats 2026-05-09

Généré par \`qa-mindmap-2026-05-09.spec.ts\` lancé à ${new Date().toISOString()}.

Setup : compte \`${TEST_USER_EMAIL}\`, baseURL UI \`http://localhost:5173\`, API \`${API_BASE}\`.

Convention : OK = comportement attendu, KO = écart constaté, PARTIAL = exécuté mais résultat ambigu.

## Détail par test

`,
  );
}

export async function openTileContextMenu(page: Page, jobIdOrAssignmentId: string): Promise<void> {
  const tile = page.locator(`[data-testid^="tile-"][data-job-id="${jobIdOrAssignmentId}"]`).first();
  await tile.scrollIntoViewIfNeeded();
  await tile.click({ button: 'right' });
  await page.locator('[data-testid="tile-context-menu"]').waitFor({ state: 'visible', timeout: 5000 });
}

export async function clickContextItem(page: Page, action: string): Promise<void> {
  await page.locator(`[data-testid="context-menu-${action}"]`).click();
}

export async function waitForGridIdle(page: Page, timeoutMs = 8000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => undefined);
  await page.waitForTimeout(500);
}

export async function disposeApiContext(): Promise<void> {
  if (_ctx) {
    await _ctx.dispose();
    _ctx = null;
    _token = null;
  }
}
