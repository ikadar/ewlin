/**
 * Playwright test — Operator concurrent groups editor (Phase 1.3 + 2b end-to-end).
 *
 * What this test does:
 * 1. Creates two test stations and a test operator (Ludovic) with skills
 *    on both, via the real PHP API.
 * 2. Opens the Operators settings page.
 * 3. Opens Ludovic's edit modal.
 * 4. Adds a "Groupes concurrents" section entry pairing the two stations
 *    with productivity 0.85 / 0.90.
 * 5. Saves.
 * 6. Verifies the group was persisted by re-fetching via the API.
 *
 * Run with:
 *   pnpm playwright test concurrent-groups-editor --headed --workers=1
 *
 * The --headed flag makes the browser visible so you can watch each step.
 * Add `await page.pause()` between steps to break and inspect manually.
 */

import { test, expect, request } from '@playwright/test';
import type { Page } from '@playwright/test';

const API_BASE_URL = 'http://localhost:8080/api/v1';
const TEST_USER_EMAIL = 'pwtest@flux.local';
const TEST_USER_PASSWORD = 'PwTestPass123!';

/**
 * Local copy of injectTestAuth that uses the pwtest@ user instead of the
 * default admin@flux.local that the shared helper hardcodes (which has
 * an unknown password on this DB).
 */
async function injectTestAuth(page: Page): Promise<void> {
  const apiContext = await request.newContext();
  const response = await apiContext.post(`${API_BASE_URL}/auth/login`, {
    data: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
  });
  if (!response.ok()) {
    throw new Error(`Test login failed: ${response.status()} ${await response.text()}`);
  }
  const { token, refreshToken, user } = await response.json();
  await apiContext.dispose();

  await page.addInitScript(({ token, refreshToken, user }) => {
    localStorage.setItem('flux_auth_token', token);
    localStorage.setItem('flux_refresh_token', refreshToken);
    localStorage.setItem('flux_auth_user', JSON.stringify(user));
  }, { token, refreshToken, user });
}

interface CreatedFixture {
  token: string;
  tag: string;
  categoryId: string;
  groupId: string;
  stationSbgId: string;
  stationMboId: string;
  operatorId: string;
}

/**
 * Create a category, group, two stations, and Ludovic with both skills via
 * the real PHP API. Returns the IDs so the test can assert against them.
 *
 * Names are prefixed with "test-cg-" so they're easy to spot and clean up.
 */
async function createTestFixture(): Promise<CreatedFixture> {
  const apiContext = await request.newContext();

  const loginRes = await apiContext.post(`${API_BASE_URL}/auth/login`, {
    data: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
  });
  if (!loginRes.ok()) {
    throw new Error(`Login failed: ${loginRes.status()} ${await loginRes.text()}`);
  }
  const { token } = await loginRes.json();
  const auth = { Authorization: `Bearer ${token}` };

  const tag = `test-cg-${Date.now()}`;

  // Category
  const catRes = await apiContext.post(`${API_BASE_URL}/station-categories`, {
    headers: auth,
    data: { name: `${tag}-cat`, description: 'Playwright test category' },
  });
  if (!catRes.ok()) throw new Error(`Category creation failed: ${catRes.status()} ${await catRes.text()}`);
  const category = await catRes.json();

  // Group
  const grpRes = await apiContext.post(`${API_BASE_URL}/station-groups`, {
    headers: auth,
    data: { name: `${tag}-grp` },
  });
  if (!grpRes.ok()) throw new Error(`Group creation failed: ${grpRes.status()} ${await grpRes.text()}`);
  const group = await grpRes.json();

  // Two stations
  const sbgRes = await apiContext.post(`${API_BASE_URL}/stations`, {
    headers: auth,
    data: {
      name: `${tag}-SBG`,
      categoryId: category.id,
      groupId: group.id,
      capacity: 1,
      maskedTimeEnabled: true,
    },
  });
  if (!sbgRes.ok()) throw new Error(`SBG station creation failed: ${sbgRes.status()} ${await sbgRes.text()}`);
  const sbg = await sbgRes.json();

  const mboRes = await apiContext.post(`${API_BASE_URL}/stations`, {
    headers: auth,
    data: {
      name: `${tag}-MBO-XL`,
      categoryId: category.id,
      groupId: group.id,
      capacity: 1,
      maskedTimeEnabled: true,
    },
  });
  if (!mboRes.ok()) throw new Error(`MBO station creation failed: ${mboRes.status()} ${await mboRes.text()}`);
  const mbo = await mboRes.json();

  // Operator with both skills
  const opRes = await apiContext.post(`${API_BASE_URL}/operators`, {
    headers: auth,
    data: {
      firstName: 'Ludovic',
      lastName: tag,
      role: 'Conducteur',
      skills: [
        { stationId: sbg.id, proficiency: 1.0 },
        { stationId: mbo.id, proficiency: 1.0 },
      ],
    },
  });
  if (!opRes.ok()) throw new Error(`Operator creation failed: ${opRes.status()} ${await opRes.text()}`);
  const operator = await opRes.json();

  await apiContext.dispose();

  return {
    token,
    tag,
    categoryId: category.id,
    groupId: group.id,
    stationSbgId: sbg.id,
    stationMboId: mbo.id,
    operatorId: operator.id,
  };
}

async function fetchOperator(token: string, operatorId: string) {
  const apiContext = await request.newContext();
  const res = await apiContext.get(`${API_BASE_URL}/operators/${operatorId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) throw new Error(`Operator fetch failed: ${res.status()}`);
  const operator = await res.json();
  await apiContext.dispose();
  return operator;
}

test.describe('Operator concurrent groups — end-to-end editor', () => {
  test('configure a concurrent group via the modal and verify persistence', async ({ page }) => {
    // Phase 1: create the test fixture via API.
    const fixture = await createTestFixture();
    const tag = fixture.tag;
    console.log('Created fixture:', fixture);

    // Phase 2: log in via the test helper, then navigate to the Operators page.
    await injectTestAuth(page);
    await page.goto('/settings/operators');
    await expect(page.getByRole('heading', { name: 'Opérateurs' })).toBeVisible();

    // Phase 3: find OUR Ludovic by the unique tag in the lastName column,
    // not by first name (the DB may already contain other Ludovic operators).
    await page.getByPlaceholder(/Rechercher/).fill(tag);
    const row = page.locator('tr', { hasText: tag });
    await expect(row).toHaveCount(1);
    await row.getByTitle('Modifier').click();

    // Modal opens
    await expect(page.getByRole('heading', { name: /Modifier l.opérateur/ })).toBeVisible();

    // Phase 4: scroll to the Groupes concurrents section and add a group.
    const sectionHeader = page.getByText('Groupes concurrents', { exact: true });
    await sectionHeader.scrollIntoViewIfNeeded();
    await expect(sectionHeader).toBeVisible();

    const addBtn = page.getByRole('button', { name: '+ Ajouter un groupe concurrent' });
    await addBtn.click();

    // The new row appears with two selects + two number inputs + a × button.
    // We use the aria-labels added in MINOR fix #9.
    const slot1 = page.getByLabel('Station 1 du groupe concurrent 1');
    const slot2 = page.getByLabel('Station 2 du groupe concurrent 1');
    const prod1 = page.getByLabel('Productivité de la station 1 dans le groupe 1');
    const prod2 = page.getByLabel('Productivité de la station 2 dans le groupe 1');

    // Select station options. The select displays the station name; we look
    // them up by partial match against our tag (which contains a unique ts).
    await slot1.selectOption({ label: `${tag}-SBG` }).catch(async () => {
      // Fallback if the label-based selector misses: pick the first non-empty
      // option, then assert that the chosen station is one of ours.
      const options = await slot1.locator('option').allTextContents();
      const sbgOpt = options.find((o) => o.includes('SBG')) ?? options[1];
      await slot1.selectOption({ label: sbgOpt });
    });
    await slot2.selectOption({ label: `${tag}-MBO-XL` }).catch(async () => {
      const options = await slot2.locator('option').allTextContents();
      const mboOpt = options.find((o) => o.includes('MBO')) ?? options[1];
      await slot2.selectOption({ label: mboOpt });
    });

    // Set productivity values.
    await prod1.fill('0.85');
    await prod1.blur();
    await prod2.fill('0.9');
    await prod2.blur();

    // Phase 5: save.
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    // Wait for the modal to close (operator list visible again, no modal heading).
    await expect(page.getByRole('heading', { name: /Modifier l.opérateur/ })).toBeHidden();

    // Phase 6: verify persistence via the API.
    const operator = await fetchOperator(fixture.token, fixture.operatorId);
    console.log('Operator after save:', JSON.stringify(operator.concurrentGroups, null, 2));

    expect(operator.concurrentGroups).toBeDefined();
    expect(operator.concurrentGroups).toHaveLength(1);

    const grp = operator.concurrentGroups[0];
    // Backend stores stationIds in canonical sorted order — they may differ
    // from the slot order in the modal.
    expect(grp.stationIds).toHaveLength(2);
    expect(grp.stationIds).toContain(fixture.stationSbgId);
    expect(grp.stationIds).toContain(fixture.stationMboId);

    expect(grp.effectiveProductivity[fixture.stationSbgId]).toBeCloseTo(0.85, 2);
    expect(grp.effectiveProductivity[fixture.stationMboId]).toBeCloseTo(0.90, 2);
  });
});
