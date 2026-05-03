/**
 * Station Staffing Form — End-to-end Playwright tests
 *
 * Validates the chantier "phase-specific staffing model on Station" UI :
 * - Form exposes the 7 staffing fields (3 calage + 3 run + speed cap)
 * - Cross-field validation surfaces inline + disables the Save button
 * - Legacy field names (attentionFull, maxOperators) are gone from the UI
 * - Opening an existing station with the 3 reference archetypes (Table,
 *   Encarteuse Heidelberg, "normal" Plieuse) hydrates the form inputs
 *   with the persisted values, and editing → resaving propagates back
 *   through the real PHP API
 *
 * Auth : real login via the dedicated `staffing-test@flux.local` user
 * created by `app:user:create-admin` for this chantier.
 *
 * Selector strategy : data-testid attributes (added on the new staffing
 * inputs alongside this test) so the assertions don't break on label
 * tweaks, plus role+name for buttons and headings.
 *
 * Why not "create via the form" : the modal's Catégorie + Groupe
 * dropdowns rely on async snapshot data (RTK Query) — racing them is
 * flakier than calling the API directly. The form's create path is
 * exercised in the manual UAT script in /tmp/staffing_e2e_test.sh.
 */

import { test, expect, request, type Page } from '@playwright/test';

const API_BASE = 'http://localhost:8080/api/v1';
const TEST_EMAIL = 'staffing-test@flux.local';
const TEST_PASSWORD = 'ChantierStaffing2026!';

interface ApiCreds {
  token: string;
  refreshToken: string;
  user: unknown;
}

async function login(): Promise<ApiCreds> {
  const ctx = await request.newContext();
  const res = await ctx.post(`${API_BASE}/auth/login`, {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  if (!res.ok()) throw new Error(`Login failed ${res.status()}: ${await res.text()}`);
  const body = await res.json();
  await ctx.dispose();
  return body as ApiCreds;
}

async function injectAuth(page: Page, creds: ApiCreds): Promise<void> {
  await page.addInitScript((c) => {
    localStorage.setItem('flux_auth_token', c.token);
    localStorage.setItem('flux_refresh_token', c.refreshToken);
    localStorage.setItem('flux_auth_user', JSON.stringify(c.user));
  }, creds);
}

async function pickCategoryAndGroup(token: string): Promise<{ categoryId: string; groupId: string }> {
  const ctx = await request.newContext();
  const auth = { Authorization: `Bearer ${token}` };
  const cats = await (await ctx.get(`${API_BASE}/station-categories`, { headers: auth })).json();
  const grps = await (await ctx.get(`${API_BASE}/station-groups`, { headers: auth })).json();
  await ctx.dispose();
  const categoryId = (cats.data ?? cats)[0].id;
  const groupId = ((grps.data ?? grps).find((g: { isOutsourcedProviderGroup?: boolean }) => !g.isOutsourcedProviderGroup) ?? (grps.data ?? grps)[0]).id;
  return { categoryId, groupId };
}

async function createStationViaApi(
  token: string,
  payload: Record<string, unknown>,
): Promise<{ id: string }> {
  const ctx = await request.newContext();
  const res = await ctx.post(`${API_BASE}/stations`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: payload,
  });
  if (!res.ok()) throw new Error(`Create failed ${res.status()}: ${await res.text()}`);
  const body = await res.json();
  await ctx.dispose();
  return body as { id: string };
}

async function deleteStation(token: string, id: string): Promise<void> {
  const ctx = await request.newContext();
  await ctx.delete(`${API_BASE}/stations/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await ctx.dispose();
}

async function fetchStation(token: string, id: string): Promise<Record<string, unknown>> {
  const ctx = await request.newContext();
  const body = await (
    await ctx.get(`${API_BASE}/stations/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json();
  await ctx.dispose();
  return body;
}

/**
 * Open the edit modal for the given station (by name) on /settings/stations.
 * Waits for the table to populate so the row is reliably reachable.
 */
async function openEditModalForStation(page: Page, name: string): Promise<void> {
  await page.goto('/settings/stations');
  await expect(page.getByRole('button', { name: 'Nouvelle station' })).toBeVisible({
    timeout: 15000,
  });
  // Search the row by name
  const row = page.locator('tbody tr', { hasText: name });
  await expect(row).toBeVisible({ timeout: 15000 });
  // The "Modifier" (FolderOpen) button — distinguishable from the
  // sibling "Supprimer" (Trash2) by its title attribute.
  await row.getByRole('button', { name: 'Modifier' }).click();
  await expect(page.getByRole('heading', { name: 'Modifier la station' })).toBeVisible({
    timeout: 10000,
  });
}

test.describe('Station staffing form — chantier validation', () => {
  let creds: ApiCreds;
  let categoryId: string;
  let groupId: string;
  const createdIds: string[] = [];

  test.beforeAll(async () => {
    creds = await login();
    const ids = await pickCategoryAndGroup(creds.token);
    categoryId = ids.categoryId;
    groupId = ids.groupId;
  });

  test.afterAll(async () => {
    await Promise.allSettled(createdIds.map((id) => deleteStation(creds.token, id)));
  });

  test.beforeEach(async ({ page }) => {
    await injectAuth(page, creds);
  });

  test('form exposes the 3 staffing subsections + new fields, no legacy labels', async ({
    page,
  }) => {
    await page.goto('/settings/stations');
    const newBtn = page.getByRole('button', { name: 'Nouvelle station' });
    await expect(newBtn).toBeVisible({ timeout: 15000 });
    await newBtn.click();
    await expect(page.getByRole('heading', { name: 'Nouvelle station' })).toBeVisible();

    // Three subsection labels
    await expect(page.getByText('Calage', { exact: true })).toBeVisible();
    await expect(page.getByText('Roule', { exact: true })).toBeVisible();
    await expect(page.getByText('Timing', { exact: true })).toBeVisible();

    // All 7 staffing inputs are present
    await expect(page.getByTestId('staffing-min-setup-operators')).toBeVisible();
    await expect(page.getByTestId('staffing-attention-setup')).toBeVisible();
    await expect(page.getByTestId('staffing-max-setup-operators')).toBeVisible();
    await expect(page.getByTestId('staffing-min-run-operators')).toBeVisible();
    await expect(page.getByTestId('staffing-attention-run')).toBeVisible();
    await expect(page.getByTestId('staffing-max-run-operators')).toBeVisible();
    await expect(page.getByTestId('staffing-max-run-attention')).toBeVisible();

    // Legacy labels are GONE from the form
    await expect(page.getByText('Attention calage', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Attention roulage', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Max opérateurs', { exact: true })).toHaveCount(0);

    // New "Plafond vitesse" label is present
    await expect(page.getByText('Plafond vitesse', { exact: true })).toBeVisible();
  });

  test('cross-field validation : min > max disables Save and surfaces the hint', async ({
    page,
  }) => {
    await page.goto('/settings/stations');
    const newBtn = page.getByRole('button', { name: 'Nouvelle station' });
    await expect(newBtn).toBeVisible({ timeout: 15000 });
    await newBtn.click();
    await expect(page.getByRole('heading', { name: 'Nouvelle station' })).toBeVisible();

    await page.getByTestId('station-name-input').fill(`E2E-Validation-${Date.now()}`);

    // Run min=5, max=1 → invalid order
    await page.getByTestId('staffing-min-run-operators').fill('5');
    await page.getByTestId('staffing-max-run-operators').fill('1');

    const errMsg = page.getByText(/Vérifiez l'ordre staffing/);
    await expect(errMsg).toBeVisible();

    const saveBtn = page.getByRole('button', { name: /Enregistrer/ });
    await expect(saveBtn).toBeDisabled();

    // Repair: max=5 → valid again
    await page.getByTestId('staffing-max-run-operators').fill('5');
    await expect(errMsg).toHaveCount(0);
    await expect(saveBtn).toBeEnabled();
  });

  test('opens a saved Table de pliage and shows the persisted staffing values', async ({
    page,
  }) => {
    const stationName = `E2E-Table-Open-${Date.now()}`;
    const { id } = await createStationViaApi(creds.token, {
      name: stationName,
      categoryId,
      groupId,
      capacity: 1,
      attentionSetup: 1.0,
      attentionRun: 1.0,
      minSetupOperators: 1,
      maxSetupOperators: 1,
      minRunOperators: 1,
      maxRunOperators: 5,
      maxRunAttention: null,
    });
    createdIds.push(id);

    await openEditModalForStation(page, stationName);

    // Form pre-populates each input with the persisted value
    await expect(page.getByTestId('staffing-min-setup-operators')).toHaveValue('1');
    await expect(page.getByTestId('staffing-attention-setup')).toHaveValue('1');
    await expect(page.getByTestId('staffing-max-setup-operators')).toHaveValue('1');
    await expect(page.getByTestId('staffing-min-run-operators')).toHaveValue('1');
    await expect(page.getByTestId('staffing-attention-run')).toHaveValue('1');
    await expect(page.getByTestId('staffing-max-run-operators')).toHaveValue('5');
    // Speed cap was null → input renders empty (placeholder visible)
    await expect(page.getByTestId('staffing-max-run-attention')).toHaveValue('');
  });

  test('opens a saved Encarteuse Heidelberg (max=2, cap=2) and shows the values', async ({
    page,
  }) => {
    const stationName = `E2E-Encarteuse-Open-${Date.now()}`;
    const { id } = await createStationViaApi(creds.token, {
      name: stationName,
      categoryId,
      groupId,
      capacity: 1,
      attentionSetup: 1.0,
      attentionRun: 2.0,
      minSetupOperators: 1,
      maxSetupOperators: 1,
      minRunOperators: 1,
      maxRunOperators: 2,
      maxRunAttention: 2.0,
    });
    createdIds.push(id);

    await openEditModalForStation(page, stationName);

    await expect(page.getByTestId('staffing-attention-setup')).toHaveValue('1');
    await expect(page.getByTestId('staffing-attention-run')).toHaveValue('2');
    await expect(page.getByTestId('staffing-min-run-operators')).toHaveValue('1');
    await expect(page.getByTestId('staffing-max-run-operators')).toHaveValue('2');
    await expect(page.getByTestId('staffing-max-run-attention')).toHaveValue('2');
  });

  test('opens a "normal" station (no override) and shows defaults of 1', async ({
    page,
  }) => {
    const stationName = `E2E-Plieuse-Open-${Date.now()}`;
    // Create with NO staffing overrides — every field should arrive as null
    const { id } = await createStationViaApi(creds.token, {
      name: stationName,
      categoryId,
      groupId,
      capacity: 1,
    });
    createdIds.push(id);

    await openEditModalForStation(page, stationName);

    // Form falls back to "1" placeholder because state init is
    // `String(initial?.X ?? 1)` for these fields. The speed cap is the
    // only field that initialises to "" when the API value is null.
    await expect(page.getByTestId('staffing-min-setup-operators')).toHaveValue('1');
    await expect(page.getByTestId('staffing-attention-setup')).toHaveValue('1');
    await expect(page.getByTestId('staffing-max-setup-operators')).toHaveValue('1');
    await expect(page.getByTestId('staffing-min-run-operators')).toHaveValue('1');
    await expect(page.getByTestId('staffing-attention-run')).toHaveValue('1');
    await expect(page.getByTestId('staffing-max-run-operators')).toHaveValue('1');
    await expect(page.getByTestId('staffing-max-run-attention')).toHaveValue('');
  });

  test('edits a saved Table : bumps maxRunOperators 5 → 8 and persists via PUT', async ({
    page,
  }) => {
    const stationName = `E2E-Table-Edit-${Date.now()}`;
    const { id } = await createStationViaApi(creds.token, {
      name: stationName,
      categoryId,
      groupId,
      capacity: 1,
      attentionSetup: 1.0,
      attentionRun: 1.0,
      minSetupOperators: 1,
      maxSetupOperators: 1,
      minRunOperators: 1,
      maxRunOperators: 5,
      maxRunAttention: null,
    });
    createdIds.push(id);

    await openEditModalForStation(page, stationName);

    // Bump max_run_operators from 5 to 8
    await page.getByTestId('staffing-max-run-operators').fill('8');

    const [putResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes(`/api/v1/stations/${id}`) && r.request().method() === 'PUT',
        { timeout: 15000 },
      ),
      page.getByRole('button', { name: /Enregistrer/ }).click(),
    ]);
    expect(
      putResp.status(),
      `PUT /stations/${id} returned ${putResp.status()}: ${await putResp.text()}`,
    ).toBe(200);

    // Modal closes
    await expect(page.getByRole('heading', { name: 'Modifier la station' })).toHaveCount(0);

    // Verify persistence via fresh GET
    const fresh = await fetchStation(creds.token, id);
    expect(fresh.maxRunOperators).toBe(8);
    // Other fields untouched
    expect(fresh.attentionRun).toBe(1);
    expect(fresh.minRunOperators).toBe(1);
  });
});
