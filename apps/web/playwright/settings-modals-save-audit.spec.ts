/**
 * Settings Modals Save Audit
 *
 * Systematically visits every settings page and verifies that modal
 * save operations complete without 5xx errors from the backend.
 *
 * Strategy:
 *   - CRUD pages: open "Nouveau" modal → fill minimal required fields →
 *     submit → assert no 5xx → delete the created entry to clean up.
 *   - Config pages: save current value (idempotent) → assert no 5xx.
 *   - Non-modal pages: just verify they load without error.
 *
 * Auth: real login via `claude-test@flux.local`.
 */

import { test, expect, request, type Page } from '@playwright/test';

const API_BASE = 'http://localhost:8080/api/v1';
const TEST_EMAIL = 'claude-test@flux.local';
const TEST_PASSWORD = 'ClaudeAuditPwd!';
const TEST_PREFIX = 'PW_AUDIT_';

test.setTimeout(60_000);

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

// ---------------------------------------------------------------------------
// 5xx tracker — attaches to every API response on the page
// ---------------------------------------------------------------------------

interface ApiError {
  url: string;
  status: number;
  method: string;
}

function track5xx(page: Page): { errors: ApiError[] } {
  const tracker = { errors: [] as ApiError[] };
  page.on('response', (resp) => {
    const url = resp.url();
    if (url.includes('/api/') && resp.status() >= 500) {
      const req = resp.request();
      tracker.errors.push({ url, status: resp.status(), method: req.method() });
    }
  });
  return tracker;
}

// ---------------------------------------------------------------------------
// Helper: wait for page to be interactive (RTK queries loaded)
// ---------------------------------------------------------------------------

async function waitForSettingsReady(page: Page, timeout = 15_000): Promise<void> {
  await page.locator('table tbody tr, input[type="range"], form input, [data-testid]').first().waitFor({ timeout });
}

// ---------------------------------------------------------------------------
// Helper: API-based cleanup — delete an entity by id
// ---------------------------------------------------------------------------

async function apiDelete(token: string, endpoint: string, id: string): Promise<void> {
  const ctx = await request.newContext();
  await ctx.delete(`${API_BASE}/${endpoint}/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await ctx.dispose();
}

// ---------------------------------------------------------------------------
// Helper: find the id of a just-created entity via API
// ---------------------------------------------------------------------------

async function findCreatedId(token: string, endpoint: string, nameField: string, nameValue: string): Promise<string | null> {
  const ctx = await request.newContext();
  const res = await ctx.get(`${API_BASE}/${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) return null;
  const raw = await res.json();
  const items: Record<string, unknown>[] =
    Array.isArray(raw) ? raw :
    Array.isArray(raw.data) ? raw.data :
    Array.isArray(raw.items) ? raw.items :
    [];
  const found = items.find((item) => item[nameField] === nameValue);
  await ctx.dispose();
  return (found?.id as string) ?? null;
}

// ---------------------------------------------------------------------------
// MODAL locator + wait for POST response
// ---------------------------------------------------------------------------

const MODAL = '.fixed.inset-0.z-50';

async function submitAndWaitForClose(page: Page, tracker: { errors: ApiError[] }): Promise<void> {
  const saveBtn = page.locator(`${MODAL} button[type="submit"]`);
  await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
  await saveBtn.click();
  await expect(page.locator(MODAL)).not.toBeVisible({ timeout: 15_000 });
  expect(tracker.errors).toEqual([]);
}

// ============================================================================
// Test suite
// ============================================================================

test.describe('Settings Modals Save Audit', () => {
  let creds: ApiCreds;

  test.beforeAll(async () => {
    creds = await login();
  });

  // ==========================================================================
  // A) CRUD pages — simple name-only modals
  // ==========================================================================

  for (const { route, endpoint, nameField, label } of [
    { route: '/settings/clients', endpoint: 'clients', nameField: 'name', label: 'client' },
    { route: '/settings/referents', endpoint: 'referents', nameField: 'name', label: 'referent' },
    { route: '/settings/shippers', endpoint: 'shippers', nameField: 'name', label: 'shipper' },
  ]) {
    test(`CRUD — ${route} : create + save`, async ({ page }) => {
      const tracker = track5xx(page);
      await injectAuth(page, creds);

      await page.goto(route);
      await waitForSettingsReady(page);

      const addBtn = page.locator('button').filter({ has: page.locator('svg.lucide-plus') });
      await addBtn.first().click();
      await page.locator(MODAL).waitFor({ timeout: 3_000 });

      const testName = `${TEST_PREFIX}${label}_${Date.now()}`;
      const input = page.locator(`${MODAL} input[type="text"]`).first();
      await input.fill(testName);

      await submitAndWaitForClose(page, tracker);

      const id = await findCreatedId(creds.token, endpoint, nameField, testName);
      if (id) await apiDelete(creds.token, endpoint, id);
    });
  }

  // ==========================================================================
  // B) CRUD — Station Categories (name + abbreviation)
  // ==========================================================================

  test('CRUD — /settings/station-categories : create + save', async ({ page }) => {
    const tracker = track5xx(page);
    await injectAuth(page, creds);

    await page.goto('/settings/station-categories');
    await waitForSettingsReady(page);

    const addBtn = page.locator('button').filter({ has: page.locator('svg.lucide-plus') });
    await addBtn.first().click();
    await page.locator(MODAL).waitFor({ timeout: 3_000 });

    const testName = `${TEST_PREFIX}Cat_${Date.now()}`;
    const nameInput = page.locator(`${MODAL} input[type="text"]`).first();
    await nameInput.fill(testName);

    await submitAndWaitForClose(page, tracker);

    expect(tracker.errors).toEqual([]);

    const id = await findCreatedId(creds.token, 'station-categories', 'name', testName);
    if (id) await apiDelete(creds.token, 'station-categories', id);
  });

  // ==========================================================================
  // C) CRUD — Formats (name must pass DSL validation + width/height)
  // ==========================================================================

  test('CRUD — /settings/formats : create + save', async ({ page }) => {
    const tracker = track5xx(page);
    await injectAuth(page, creds);

    await page.goto('/settings/formats');
    await waitForSettingsReady(page);

    const addBtn = page.locator('button').filter({ has: page.locator('svg.lucide-plus') });
    await addBtn.first().click();
    await page.locator(MODAL).waitFor({ timeout: 3_000 });

    // Format name must pass isValidFormat — use NxN pattern
    const ts = Date.now().toString().slice(-4);
    const testName = `${ts}x9999`;
    const nameInput = page.locator(`${MODAL} input[type="text"], ${MODAL} input[role="combobox"]`).first();
    await nameInput.fill(testName);
    await nameInput.press('Tab');

    // Width and height should be auto-filled from the name
    // but fill them explicitly just in case
    const widthInput = page.locator(`${MODAL} input[type="number"]`).nth(0);
    const heightInput = page.locator(`${MODAL} input[type="number"]`).nth(1);
    if (await widthInput.inputValue() === '') await widthInput.fill(ts);
    if (await heightInput.inputValue() === '') await heightInput.fill('9999');

    await submitAndWaitForClose(page, tracker);

    expect(tracker.errors).toEqual([]);

    const id = await findCreatedId(creds.token, 'formats', 'name', testName);
    if (id) await apiDelete(creds.token, 'formats', id);
  });

  // ==========================================================================
  // D) CRUD — Impression Presets (value must be valid DSL like "4/0")
  // ==========================================================================

  test('CRUD — /settings/impression-presets : create + save', async ({ page }) => {
    const tracker = track5xx(page);
    await injectAuth(page, creds);

    await page.goto('/settings/impression-presets');
    await waitForSettingsReady(page);

    const addBtn = page.locator('button').filter({ has: page.locator('svg.lucide-plus') });
    await addBtn.first().click();
    await page.locator(MODAL).waitFor({ timeout: 3_000 });

    // Value must contain "/" AND description must be non-empty
    const ts = Date.now().toString().slice(-2);
    const testValue = `${ts}/0`;
    const inputs = page.locator(`${MODAL} input[type="text"]`);
    await inputs.nth(0).fill(testValue);
    await inputs.nth(0).press('Tab');
    // Fill description (2nd or 3rd text input)
    const descInput = inputs.nth(1);
    await descInput.fill('PW audit test');

    await submitAndWaitForClose(page, tracker);

    const id = await findCreatedId(creds.token, 'impression-presets', 'value', testValue);
    if (id) await apiDelete(creds.token, 'impression-presets', id);
  });

  // ==========================================================================
  // E) CRUD — Surfacage Presets (value must be valid DSL like "V/N")
  // ==========================================================================

  test('CRUD — /settings/surfacage-presets : create + save', async ({ page }) => {
    const tracker = track5xx(page);
    await injectAuth(page, creds);

    await page.goto('/settings/surfacage-presets');
    await waitForSettingsReady(page);

    const addBtn = page.locator('button').filter({ has: page.locator('svg.lucide-plus') });
    await addBtn.first().click();
    await page.locator(MODAL).waitFor({ timeout: 3_000 });

    // Value must contain "/" AND description must be non-empty
    const ts = Date.now().toString().slice(-2);
    const testValue = `V${ts}/N`;
    const inputs = page.locator(`${MODAL} input[type="text"]`);
    await inputs.nth(0).fill(testValue);
    await inputs.nth(0).press('Tab');
    // Fill description
    const descInput = inputs.nth(1);
    await descInput.fill('PW audit test');

    await submitAndWaitForClose(page, tracker);

    const id = await findCreatedId(creds.token, 'surfacage-presets', 'value', testValue);
    if (id) await apiDelete(creds.token, 'surfacage-presets', id);
  });

  // ==========================================================================
  // F) CRUD — Feuille Formats (format NxN + poses)
  // ==========================================================================

  test('CRUD — /settings/feuille-formats : create + save', async ({ page }) => {
    const tracker = track5xx(page);
    await injectAuth(page, creds);

    await page.goto('/settings/feuille-formats');
    await waitForSettingsReady(page);

    const addBtn = page.locator('button').filter({ has: page.locator('svg.lucide-plus') });
    await addBtn.first().click();
    await page.locator(MODAL).waitFor({ timeout: 3_000 });

    const testFormat = `${Date.now().toString().slice(-4)}x9999`;
    const formatInput = page.locator(`${MODAL} input[type="text"]`).first();
    await formatInput.fill(testFormat);
    await formatInput.press('Tab');

    // Select at least one pose
    const poseBtn = page.locator(`${MODAL} button`).filter({ hasText: /^1$/ }).first();
    if (await poseBtn.isVisible().catch(() => false)) {
      await poseBtn.click();
    }

    await submitAndWaitForClose(page, tracker);

    expect(tracker.errors).toEqual([]);

    const id = await findCreatedId(creds.token, 'feuille-formats', 'format', testFormat);
    if (id) await apiDelete(creds.token, 'feuille-formats', id);
  });

  // ==========================================================================
  // G) CRUD — Outsourced Providers (name + times)
  // ==========================================================================

  test('CRUD — /settings/providers : create + save', async ({ page }) => {
    const tracker = track5xx(page);
    await injectAuth(page, creds);

    await page.goto('/settings/providers');
    await waitForSettingsReady(page);

    const addBtn = page.locator('button').filter({ has: page.locator('svg.lucide-plus') });
    await addBtn.first().click();
    await page.locator(MODAL).waitFor({ timeout: 3_000 });

    const testName = `${TEST_PREFIX}Prov_${Date.now()}`;
    const nameInput = page.locator(`${MODAL} input[type="text"]`).first();
    await nameInput.fill(testName);

    await submitAndWaitForClose(page, tracker);

    expect(tracker.errors).toEqual([]);

    const id = await findCreatedId(creds.token, 'outsourced-providers', 'name', testName);
    if (id) await apiDelete(creds.token, 'outsourced-providers', id);
  });

  // ==========================================================================
  // H) CRUD — Stations (name + category/group default from dropdowns)
  // ==========================================================================

  test('CRUD — /settings/stations : create + save', async ({ page }) => {
    const tracker = track5xx(page);
    await injectAuth(page, creds);

    await page.goto('/settings/stations');
    await waitForSettingsReady(page);

    // Wait a bit longer for async categories/groups data to settle
    await page.waitForTimeout(2_000);

    const addBtn = page.locator('button').filter({ has: page.locator('svg.lucide-plus') });
    await addBtn.first().click();
    await page.locator(MODAL).waitFor({ timeout: 5_000 });

    const testName = `${TEST_PREFIX}Station_${Date.now()}`;
    const nameInput = page.locator('[data-testid="station-name-input"]');
    await nameInput.fill(testName);

    // FluxSelect dropdowns: find Category & Group trigger buttons and select first option
    // The modal has grid with labels "Catégorie" and "Groupe", each followed by a FluxSelect button
    const modal = page.locator(MODAL);

    // Category FluxSelect: find the button that's a sibling of the "Catégorie" label
    const catButton = modal.locator('label:has-text("Catégorie")').locator('..').locator('button[type="button"]').first();
    await catButton.click();
    // FluxSelect renders options in a portal — look for the dropdown buttons
    const catOption = page.locator('body > div').last().locator('button').first();
    await catOption.waitFor({ timeout: 3_000 });
    await catOption.click();

    // Group FluxSelect
    const grpButton = modal.locator('label:has-text("Groupe")').locator('..').locator('button[type="button"]').first();
    await grpButton.click();
    const grpOption = page.locator('body > div').last().locator('button').first();
    await grpOption.waitFor({ timeout: 3_000 });
    await grpOption.click();

    await submitAndWaitForClose(page, tracker);

    const id = await findCreatedId(creds.token, 'stations', 'name', testName);
    if (id) await apiDelete(creds.token, 'stations', id);
  });

  // ==========================================================================
  // I) CRUD — Operators (firstName + lastName required)
  // ==========================================================================

  test('CRUD — /settings/operators : create + save', async ({ page }) => {
    const tracker = track5xx(page);
    await injectAuth(page, creds);

    await page.goto('/settings/operators');
    await waitForSettingsReady(page);

    const addBtn = page.locator('button').filter({ has: page.locator('svg.lucide-plus') });
    await addBtn.first().click();
    await page.locator(MODAL).waitFor({ timeout: 5_000 });

    const ts = Date.now();
    // Operator form has firstName (Prénom) then lastName (Nom de famille)
    const textInputs = page.locator(`${MODAL} input[type="text"]`);
    await textInputs.nth(0).fill(`${TEST_PREFIX}Prenom`);
    await textInputs.nth(1).fill(`Audit_${ts}`);

    await submitAndWaitForClose(page, tracker);

    expect(tracker.errors).toEqual([]);

    const id = await findCreatedId(creds.token, 'operators', 'firstName', `${TEST_PREFIX}Prenom`);
    if (id) await apiDelete(creds.token, 'operators', id);
  });

  // ==========================================================================
  // J) CRUD — Users (email + displayName + password min 12)
  // ==========================================================================

  test('CRUD — /settings/users : create + save', async ({ page }) => {
    const tracker = track5xx(page);
    await injectAuth(page, creds);

    await page.goto('/settings/users');
    await waitForSettingsReady(page);

    const addBtn = page.locator('button').filter({ has: page.locator('svg.lucide-plus') });
    await addBtn.first().click();
    await page.locator(MODAL).waitFor({ timeout: 3_000 });

    const ts = Date.now();
    const inputs = page.locator(`${MODAL} input`);

    // displayName (first text input)
    await inputs.nth(0).fill(`${TEST_PREFIX}User_${ts}`);
    // email
    await inputs.nth(1).fill(`pw-audit-${ts}@test.local`);
    // password (min 12 chars)
    await inputs.nth(2).fill('AuditTestPwd12!');

    await submitAndWaitForClose(page, tracker);

    expect(tracker.errors).toEqual([]);

    const id = await findCreatedId(creds.token, 'admin/users', 'email', `pw-audit-${ts}@test.local`);
    if (id) await apiDelete(creds.token, 'admin/users', id);
  });

  // ==========================================================================
  // K) CRUD — User Groups (name + permissions)
  // ==========================================================================

  test('CRUD — /settings/user-groups : create + save', async ({ page }) => {
    const tracker = track5xx(page);
    await injectAuth(page, creds);

    await page.goto('/settings/user-groups');
    await waitForSettingsReady(page);

    const addBtn = page.locator('button').filter({ has: page.locator('svg.lucide-plus') });
    await addBtn.first().click();
    await page.locator(MODAL).waitFor({ timeout: 3_000 });

    const testName = `${TEST_PREFIX}Group_${Date.now()}`;
    const nameInput = page.locator(`${MODAL} input[type="text"]`).first();
    await nameInput.fill(testName);

    await submitAndWaitForClose(page, tracker);

    expect(tracker.errors).toEqual([]);

    const id = await findCreatedId(creds.token, 'admin/user-groups', 'name', testName);
    if (id) await apiDelete(creds.token, 'admin/user-groups', id);
  });

  // ==========================================================================
  // L) Config pages — idempotent save via PUT
  // ==========================================================================

  for (const { route, label } of [
    { route: '/settings/safety-zone', label: 'Safety Zone' },
    { route: '/settings/precedence-gap', label: 'Precedence Gap' },
  ]) {
    test(`Config — ${route} : save current value`, async ({ page }) => {
      const tracker = track5xx(page);
      await injectAuth(page, creds);

      await page.goto(route);
      await waitForSettingsReady(page);

      const slider = page.locator('input[type="range"]');
      const currentValue = parseInt(await slider.inputValue());
      const maxStr = await slider.getAttribute('max');
      const max = parseInt(maxStr ?? '12');

      // Always bump UP to avoid clamping at min=0
      const tempVal = currentValue < max ? currentValue + 1 : currentValue - 1;

      // Use React-compatible setter to trigger onChange
      await page.evaluate((v) => {
        const el = document.querySelector('input[type="range"]') as HTMLInputElement;
        if (!el) return;
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value',
        )!.set!;
        nativeInputValueSetter.call(el, String(v));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, tempVal);

      const saveBtn = page.locator('button').filter({ hasText: /enregistrer/i });
      await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
      await saveBtn.click();
      await page.waitForTimeout(2_000);

      expect(tracker.errors).toEqual([]);

      // Restore via API (UI restore is unreliable due to React synthetic events)
      const ctx = await request.newContext();
      const endpoint = route.includes('safety') ? 'safety-zone' : 'precedence-gap';
      const body = endpoint === 'safety-zone'
        ? { hours: currentValue }
        : { gapTicks: currentValue };
      await ctx.put(`${API_BASE}/${endpoint}`, {
        headers: { Authorization: `Bearer ${creds.token}`, 'Content-Type': 'application/json' },
        data: body,
      });
      await ctx.dispose();
    });
  }

  // Lead-time pages (paper, forme, plate) — same pattern but with number inputs
  for (const { route, label } of [
    { route: '/settings/paper-lead-time', label: 'Paper Lead Time' },
    { route: '/settings/forme-lead-time', label: 'Forme Lead Time' },
    { route: '/settings/plate-lead-time', label: 'Plate Lead Time' },
  ]) {
    test(`Config — ${route} : save current value`, async ({ page }) => {
      const tracker = track5xx(page);
      await injectAuth(page, creds);

      await page.goto(route);
      await waitForSettingsReady(page);

      // Read current config via API, bump cutoffHour, save via UI, then restore via API
      const apiEndpoint = route.split('/settings/')[1];
      const ctx = await request.newContext();
      const configResp = await ctx.get(`${API_BASE}/${apiEndpoint}`, {
        headers: { Authorization: `Bearer ${creds.token}` },
      });
      const originalConfig = await configResp.json();

      // Bump cutoffHour in the first number input
      const firstInput = page.locator('input[type="number"], input[inputmode="numeric"]').first();
      const original = await firstInput.inputValue();
      const bumped = String((parseInt(original || '10') % 22) + 1);

      await firstInput.fill(bumped);

      const saveBtn = page.locator('button').filter({ hasText: /enregistrer/i });
      await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
      await saveBtn.click();
      await page.waitForTimeout(2_000);

      expect(tracker.errors).toEqual([]);

      // Restore via API
      await ctx.put(`${API_BASE}/${apiEndpoint}`, {
        headers: { Authorization: `Bearer ${creds.token}`, 'Content-Type': 'application/json' },
        data: originalConfig,
      });
      await ctx.dispose();
    });
  }

  // ==========================================================================
  // M) Non-modal pages — just verify they load
  // ==========================================================================

  test('Load — /settings/qr-codes-focus : page loads', async ({ page }) => {
    const tracker = track5xx(page);
    await injectAuth(page, creds);

    await page.goto('/settings/qr-codes-focus');
    await page.waitForTimeout(3_000);

    expect(tracker.errors).toEqual([]);
  });

  test('Load — /settings/tests : page loads', async ({ page }) => {
    const tracker = track5xx(page);
    await injectAuth(page, creds);

    await page.goto('/settings/tests');
    await page.waitForTimeout(3_000);

    expect(tracker.errors).toEqual([]);
  });
});
