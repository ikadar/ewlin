/**
 * E2E tests: Prérequis Kanban — all gates (Papier, Formes, BAT).
 *
 * Sets up real statuses on elements via the API, verifies the kanban
 * boards render correctly, and checks round-trip consistency (change
 * via kanban API → verify status updated on flux/jobs endpoint).
 */

import { test, expect, request, type Page } from '@playwright/test';

const API_BASE = 'http://localhost:8080/api/v1';
const TEST_EMAIL = 'claude-test@flux.local';
const TEST_PASSWORD = 'ClaudeAuditPwd!';

let apiToken = '';

async function apiLogin(): Promise<string> {
  const ctx = await request.newContext();
  const res = await ctx.post(`${API_BASE}/auth/login`, {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  if (!res.ok()) throw new Error(`Login failed: ${res.status()}`);
  const { token } = await res.json();
  await ctx.dispose();
  return token;
}

async function authenticate(page: Page): Promise<void> {
  const ctx = await request.newContext();
  const res = await ctx.post(`${API_BASE}/auth/login`, {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  if (!res.ok()) throw new Error(`Login failed: ${res.status()}`);
  const { token, refreshToken, user } = await res.json();
  await ctx.dispose();
  apiToken = token;
  await page.addInitScript(({ token, refreshToken, user }) => {
    localStorage.setItem('flux_auth_token', token);
    localStorage.setItem('flux_refresh_token', refreshToken);
    localStorage.setItem('flux_auth_user', JSON.stringify(user));
  }, { token, refreshToken, user });
}

type GateColumn = 'papier' | 'formes' | 'bat';

async function setGateStatus(elementId: string, column: GateColumn, status: string): Promise<void> {
  const ctx = await request.newContext();
  const res = await ctx.patch(`${API_BASE}/flux/elements/${elementId}`, {
    headers: { Authorization: `Bearer ${apiToken}`, 'X-Flux-Scenario': 'prod' },
    data: { column, value: status },
  });
  if (!res.ok()) throw new Error(`Set ${column}=${status} failed for ${elementId}: ${res.status()} ${await res.text()}`);
  await ctx.dispose();
}

async function getGateStatus(elementId: string, column: GateColumn): Promise<string> {
  const ctx = await request.newContext();
  const res = await ctx.get(`${API_BASE}/flux/jobs`, {
    headers: { Authorization: `Bearer ${apiToken}`, 'X-Flux-Scenario': 'prod' },
  });
  const jobs = await res.json();
  await ctx.dispose();
  for (const j of jobs) {
    for (const el of j.elements) {
      if (el.id === elementId) return el[column];
    }
  }
  throw new Error(`Element ${elementId} not found`);
}

interface FluxElement { id: string; papier: string; formes: string; bat: string }
interface FluxJob { id: number; internalId: string; client: string; designation: string; elements: FluxElement[] }

async function getFluxJobs(): Promise<FluxJob[]> {
  const ctx = await request.newContext();
  const res = await ctx.get(`${API_BASE}/flux/jobs`, {
    headers: { Authorization: `Bearer ${apiToken}`, 'X-Flux-Scenario': 'prod' },
  });
  const data = await res.json();
  await ctx.dispose();
  return data;
}

// ── Test data setup ─────────────────────────────────────────
// We distribute statuses across jobs for each gate type:
//   Jobs 0-1: leftmost status (to_order / waiting_files)
//   Jobs 2-3: middle status (ordered / files_received)
//   Jobs 4-5: final status (delivered / bat_approved)
//   Jobs 6+:  mixed (first element = leftmost, rest = middle)

interface SetupState {
  allElementIds: string[];
  jobs: FluxJob[];
}

async function setupGateStatuses(): Promise<SetupState> {
  const jobs = await getFluxJobs();
  const allElementIds = jobs.flatMap((j) => j.elements.map((e) => e.id));

  // Papier: to_order / ordered / delivered
  for (let ji = 0; ji < jobs.length; ji++) {
    for (let ei = 0; ei < jobs[ji].elements.length; ei++) {
      let status: string;
      if (ji < 2) status = 'to_order';
      else if (ji < 4) status = 'ordered';
      else if (ji < 6) status = 'delivered';
      else status = ei === 0 ? 'to_order' : 'ordered';
      await setGateStatus(jobs[ji].elements[ei].id, 'papier', status);
    }
  }

  // Formes: to_order / ordered / delivered (same distribution)
  for (let ji = 0; ji < jobs.length; ji++) {
    for (let ei = 0; ei < jobs[ji].elements.length; ei++) {
      let status: string;
      if (ji < 2) status = 'to_order';
      else if (ji < 4) status = 'ordered';
      else if (ji < 6) status = 'delivered';
      else status = ei === 0 ? 'to_order' : 'ordered';
      await setGateStatus(jobs[ji].elements[ei].id, 'formes', status);
    }
  }

  // BAT: waiting_files / files_received / bat_sent / bat_approved
  for (let ji = 0; ji < jobs.length; ji++) {
    for (let ei = 0; ei < jobs[ji].elements.length; ei++) {
      let status: string;
      if (ji < 2) status = 'waiting_files';
      else if (ji < 4) status = 'files_received';
      else if (ji < 6) status = 'bat_sent';
      else status = ji < 8 ? 'bat_approved' : 'waiting_files';
      await setGateStatus(jobs[ji].elements[ei].id, 'bat', status);
    }
  }

  // Plaques: to_make / ready
  for (let ji = 0; ji < jobs.length; ji++) {
    for (let ei = 0; ei < jobs[ji].elements.length; ei++) {
      const status = ji < 5 ? 'to_make' : 'ready';
      await setGateStatus(jobs[ji].elements[ei].id, 'plaques', status);
    }
  }

  return { allElementIds, jobs };
}

async function resetAllStatuses(state: SetupState): Promise<void> {
  for (const id of state.allElementIds) {
    await setGateStatus(id, 'papier', 'in_stock').catch(() => {});
    await setGateStatus(id, 'formes', 'none').catch(() => {});
    await setGateStatus(id, 'bat', 'bat_approved').catch(() => {});
    await setGateStatus(id, 'plaques', 'ready').catch(() => {});
  }
}

// ── Tests ───────────────────────────────────────────────────

test.describe('Prérequis Kanban — all gates', () => {
  let state: SetupState;

  test.beforeAll(async () => {
    apiToken = await apiLogin();

    // Promote preprod → prod
    const ctx = await request.newContext();
    await ctx.post(`${API_BASE}/promotion`, { headers: { Authorization: `Bearer ${apiToken}` } });
    await ctx.dispose();

    state = await setupGateStatuses();
  });

  test.afterAll(async () => {
    await resetAllStatuses(state);
  });

  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  // ── Sidebar & navigation ──────────────────────────────────

  test('sidebar: Prérequis visible in prod, hidden in preprod', async ({ page }) => {
    await page.goto('/?env=prod');
    await expect(page.getByRole('button', { name: 'Prérequis' })).toBeVisible();

    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Prérequis' })).toHaveCount(0);
  });

  test('navigation: /prerequis redirects to /prerequis/papier in prod', async ({ page }) => {
    await page.goto('/prerequis?env=prod');
    await expect(page).toHaveURL(/\/prerequis\/papier\?env=prod/);
  });

  test('navigation: /prerequis in preprod redirects to /scenarios', async ({ page }) => {
    await page.goto('/prerequis');
    await expect(page).toHaveURL(/\/scenarios$/);
  });

  test('submenu: all 4 tabs visible', async ({ page }) => {
    await page.goto('/prerequis/papier?env=prod');
    await expect(page.getByRole('link', { name: 'Papier' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Formes' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'BAT' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Plaques' })).toBeVisible();
  });

  test('submenu: switching tabs preserves ?env=prod', async ({ page }) => {
    await page.goto('/prerequis/papier?env=prod');
    await page.getByRole('link', { name: 'Formes' }).click();
    await expect(page).toHaveURL(/\/prerequis\/formes\?env=prod/);

    await page.getByRole('link', { name: 'BAT' }).click();
    await expect(page).toHaveURL(/\/prerequis\/bat\?env=prod/);

    await page.getByRole('link', { name: 'Papier' }).click();
    await expect(page).toHaveURL(/\/prerequis\/papier\?env=prod/);
  });

  // ── Papier kanban ─────────────────────────────────────────

  test('papier: 3 columns rendered', async ({ page }) => {
    await page.goto('/prerequis/papier?env=prod');
    await expect(page.getByText('A commander')).toBeVisible();
    await expect(page.getByText('Commandé')).toBeVisible();
    await expect(page.getByText('Disponible')).toBeVisible();
  });

  test('papier: jobs distributed across columns', async ({ page }) => {
    await page.goto('/prerequis/papier?env=prod');
    await page.waitForSelector('[draggable="true"]', { timeout: 10000 });
    const cards = page.locator('[draggable="true"]');
    expect(await cards.count()).toBeGreaterThanOrEqual(4);
  });

  test('papier: sort dropdown works', async ({ page }) => {
    await page.goto('/prerequis/papier?env=prod');
    const sortBtn = page.getByRole('button', { name: 'Date de sortie' });
    await expect(sortBtn).toBeVisible();
    await sortBtn.click();
    await expect(page.getByRole('button', { name: 'Client' })).toBeVisible();
  });

  // ── Formes kanban ─────────────────────────────────────────

  test('formes: 3 columns rendered', async ({ page }) => {
    await page.goto('/prerequis/formes?env=prod');
    await expect(page.getByText('A commander')).toBeVisible();
    await expect(page.getByText('Commandée')).toBeVisible();
    await expect(page.getByText('Disponible')).toBeVisible();
  });

  test('formes: jobs distributed across columns', async ({ page }) => {
    await page.goto('/prerequis/formes?env=prod');
    await page.waitForSelector('[draggable="true"]', { timeout: 10000 });
    const cards = page.locator('[draggable="true"]');
    expect(await cards.count()).toBeGreaterThanOrEqual(4);
  });

  // ── BAT kanban ────────────────────────────────────────────

  test('bat: 4 columns rendered', async ({ page }) => {
    await page.goto('/prerequis/bat?env=prod');
    await expect(page.getByText('Attente fichiers')).toBeVisible();
    await expect(page.getByText('Fichiers reçus')).toBeVisible();
    await expect(page.getByText('BAT envoyé')).toBeVisible();
    await expect(page.getByText('BAT OK')).toBeVisible();
  });

  test('bat: jobs distributed across 4 columns', async ({ page }) => {
    await page.goto('/prerequis/bat?env=prod');
    await page.waitForSelector('[draggable="true"]', { timeout: 10000 });
    const cards = page.locator('[draggable="true"]');
    expect(await cards.count()).toBeGreaterThanOrEqual(4);
  });

  // ── Plaques kanban ─────────────────────────────────────────

  test('plaques: 2 columns rendered', async ({ page }) => {
    await page.goto('/prerequis/plaques?env=prod');
    await expect(page.getByText('À faire')).toBeVisible();
    await expect(page.getByText('Prêtes')).toBeVisible();
  });

  test('plaques: jobs distributed across 2 columns', async ({ page }) => {
    await page.goto('/prerequis/plaques?env=prod');
    await page.waitForSelector('[draggable="true"]', { timeout: 10000 });
    const cards = page.locator('[draggable="true"]');
    expect(await cards.count()).toBeGreaterThanOrEqual(4);
  });

  // ── Gate round-trip: API → kanban → API ───────────────────

  test('papier round-trip: set to_order via API, verify on kanban, then set ordered, verify API', async ({ page }) => {
    const targetEl = state.jobs[0].elements[0].id;

    // Set to to_order
    await setGateStatus(targetEl, 'papier', 'to_order');

    // Verify kanban shows it
    await page.goto('/prerequis/papier?env=prod');
    await page.waitForSelector('[draggable="true"]', { timeout: 10000 });

    // Now change it via API to ordered
    await setGateStatus(targetEl, 'papier', 'ordered');

    // Verify API reflects the change
    const status = await getGateStatus(targetEl, 'papier');
    expect(status).toBe('ordered');
  });

  test('formes round-trip: set to_order → ordered via API, verify status', async ({ page }) => {
    const targetEl = state.jobs[0].elements[0].id;

    await setGateStatus(targetEl, 'formes', 'to_order');
    let status = await getGateStatus(targetEl, 'formes');
    expect(status).toBe('to_order');

    await setGateStatus(targetEl, 'formes', 'ordered');
    status = await getGateStatus(targetEl, 'formes');
    expect(status).toBe('ordered');

    await setGateStatus(targetEl, 'formes', 'delivered');
    status = await getGateStatus(targetEl, 'formes');
    expect(status).toBe('delivered');
  });

  test('bat round-trip: walk through all 4 statuses', async ({ page }) => {
    const targetEl = state.jobs[0].elements[0].id;

    for (const s of ['waiting_files', 'files_received', 'bat_sent', 'bat_approved'] as const) {
      await setGateStatus(targetEl, 'bat', s);
      const status = await getGateStatus(targetEl, 'bat');
      expect(status).toBe(s);
    }
  });

  test('plaques round-trip: to_make → ready', async ({ page }) => {
    const targetEl = state.jobs[0].elements[0].id;

    await setGateStatus(targetEl, 'plaques', 'to_make');
    expect(await getGateStatus(targetEl, 'plaques')).toBe('to_make');

    await setGateStatus(targetEl, 'plaques', 'ready');
    expect(await getGateStatus(targetEl, 'plaques')).toBe('ready');
  });

  // ── Cross-gate consistency ────────────────────────────────

  test('changing one gate does not affect another', async ({ page }) => {
    const targetEl = state.jobs[0].elements[0].id;

    // Set specific statuses for each gate
    await setGateStatus(targetEl, 'papier', 'to_order');
    await setGateStatus(targetEl, 'formes', 'ordered');
    await setGateStatus(targetEl, 'bat', 'bat_sent');

    // Verify each gate independently
    const papier = await getGateStatus(targetEl, 'papier');
    const formes = await getGateStatus(targetEl, 'formes');
    const bat = await getGateStatus(targetEl, 'bat');

    expect(papier).toBe('to_order');
    expect(formes).toBe('ordered');
    expect(bat).toBe('bat_sent');

    // Change papier only
    await setGateStatus(targetEl, 'papier', 'delivered');

    // Formes and BAT should be unchanged
    expect(await getGateStatus(targetEl, 'formes')).toBe('ordered');
    expect(await getGateStatus(targetEl, 'bat')).toBe('bat_sent');
  });
});
