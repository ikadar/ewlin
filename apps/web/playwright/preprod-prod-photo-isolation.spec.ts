/**
 * Phase A2 (Préprod-live / Prod-photo) — end-to-end isolation check.
 *
 * Validates the architectural invariant : Préprod and Prod own
 * independent physical rows (post-A2 — no more `published_at` gate
 * on shared rows). A modification in Préprod must NOT leak into Prod
 * until the chef pushes ; after the push, Prod reflects the new
 * Préprod state.
 *
 * Runs end-to-end against the real backend + DB. No browser
 * navigation — pure REST transactions through the same authenticated
 * surface the FE uses.
 *
 * Prerequisites :
 *   - Préprod + Prod scenarios bootstrapped (seed should handle this).
 *   - Migration Version20260506210000 applied (Prod-scoped rows
 *     materialised from Préprod-published rows).
 *   - At least one published job present so we have something to flip.
 *
 * @see docs/architecture/preprod-prod-photo-model.md
 */

import { expect, request, test } from '@playwright/test';

const API_BASE_URL = 'http://localhost:8080/api/v1';
const TEST_USER_EMAIL = 'claude-test@flux.local';
const TEST_USER_PASSWORD = 'ClaudeAuditPwd!';

async function getAuthToken(): Promise<string> {
  const apiContext = await request.newContext();
  const resp = await apiContext.post(`${API_BASE_URL}/auth/login`, {
    data: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
  });
  if (!resp.ok()) {
    throw new Error(`login failed ${resp.status()} ${await resp.text()}`);
  }
  const { token } = await resp.json();
  await apiContext.dispose();
  return token;
}

interface FluxJob {
  internalId: string;
  id: string;
  sortie?: string | null;
  sortieIso?: string | null;
}

async function fetchFluxJobs(token: string, scenarioHeader: 'preprod' | 'prod'): Promise<FluxJob[]> {
  const apiContext = await request.newContext();
  const resp = await apiContext.get(`${API_BASE_URL}/flux/jobs`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Flux-Scenario': scenarioHeader,
    },
  });
  expect(resp.ok()).toBe(true);
  const jobs = (await resp.json()) as FluxJob[];
  await apiContext.dispose();
  return jobs;
}

test.describe('Phase A2 — Préprod / Prod row isolation', () => {
  test('Modifying a Préprod job deadline leaves Prod unchanged until push', async () => {
    const token = await getAuthToken();

    // Snapshot the initial deadline visible from Prod context.
    const prodBefore = await fetchFluxJobs(token, 'prod');
    expect(prodBefore.length).toBeGreaterThan(0);
    const targetReference = prodBefore[0].id;
    const prodSortieBefore = prodBefore[0].sortieIso ?? null;

    // Find the matching Préprod row by reference. Préprod is a
    // superset of Prod, so the row exists.
    const preprodBefore = await fetchFluxJobs(token, 'preprod');
    const preprodTarget = preprodBefore.find((j) => j.id === targetReference);
    expect(preprodTarget).toBeDefined();

    // Build a different deadline (shift +5 days). If the Préprod
    // deadline was unset, fall back to a fixed near-future date.
    const baseDate = preprodTarget?.sortieIso !== null && preprodTarget?.sortieIso !== undefined
      ? new Date(preprodTarget.sortieIso)
      : new Date('2026-08-01');
    baseDate.setDate(baseDate.getDate() + 5);
    const newWorkshopExitDate = baseDate.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM

    // Mutate Préprod via the JCF update endpoint (PUT /jobs/{id}).
    const apiContext = await request.newContext();
    const updateResp = await apiContext.put(`${API_BASE_URL}/jobs/${preprodTarget!.internalId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Flux-Scenario': 'preprod',
        'Content-Type': 'application/json',
      },
      data: { workshopExitDate: newWorkshopExitDate },
    });
    expect(updateResp.ok(), `PUT /jobs/${preprodTarget!.internalId} failed with ${updateResp.status()}: ${await updateResp.text()}`).toBe(true);

    // Préprod sees the new deadline immediately.
    const preprodAfter = await fetchFluxJobs(token, 'preprod');
    const preprodTargetAfter = preprodAfter.find((j) => j.id === targetReference);
    expect(preprodTargetAfter).toBeDefined();
    expect(preprodTargetAfter?.sortieIso?.startsWith(newWorkshopExitDate.slice(0, 10))).toBe(true);

    // Critical assertion — Prod is *not* affected by the Préprod edit.
    // This is the architectural invariant the A2 photo model enforces.
    const prodAfterEdit = await fetchFluxJobs(token, 'prod');
    const prodTargetAfter = prodAfterEdit.find((j) => j.id === targetReference);
    expect(prodTargetAfter).toBeDefined();
    expect(prodTargetAfter?.sortieIso ?? null).toBe(prodSortieBefore);

    // Push Préprod → Prod via promotion (POST /api/v1/promotion).
    // After this, Prod reflects the Préprod modification.
    const promoteResp = await apiContext.post(`${API_BASE_URL}/promotion`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: { engineVersion: 'phase-a2-test' },
    });
    expect(promoteResp.ok(), `POST /promotion failed with ${promoteResp.status()}: ${await promoteResp.text()}`).toBe(true);

    const prodAfterPush = await fetchFluxJobs(token, 'prod');
    const prodTargetPushed = prodAfterPush.find((j) => j.id === targetReference);
    expect(prodTargetPushed).toBeDefined();
    expect(prodTargetPushed?.sortieIso?.startsWith(newWorkshopExitDate.slice(0, 10))).toBe(true);

    await apiContext.dispose();
  });
});
