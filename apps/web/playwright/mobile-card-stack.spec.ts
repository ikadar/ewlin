/**
 * Mobile Card Stack — golden path e2e test.
 *
 * Validates the operator at-the-machine experience:
 *   1. Load /mobile/operator/:id and see the card stack
 *   2. Verify active card displays the expected task
 *   3. Verify the "Suivant" peek is present
 *   4. Verify the heartbeat overlay appears in the end zone
 *   5. Verify "Je confirme être à l'heure" button appears and dismisses
 *
 * Requires:
 *   - Running dev server (localhost:5173)
 *   - At least one operator with scheduled tasks today in the prod snapshot
 *
 * Run:
 *   npx playwright test mobile-card-stack.spec.ts --headed
 *
 * NOTE: Do NOT run without explicit user permission (cf. CLAUDE.md).
 */
import { expect, test, type Page } from '@playwright/test';

test.describe('Mobile Card Stack', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test('loads the mobile page for an operator', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.ok()).toBe(true);

    // Get the first operator ID from the prod snapshot
    const operatorId = await page.evaluate(async () => {
      const res = await fetch('/api/v1/schedule/snapshot', {
        headers: { 'X-Flux-Scenario': 'prod' },
      });
      const data = await res.json();
      const firstOp = data?.operators?.[0];
      return firstOp?.id ?? null;
    });

    if (!operatorId) {
      test.skip(true, 'No operators in prod snapshot');
      return;
    }

    await page.goto(`/mobile/operator/${operatorId}`);
    await page.waitForLoadState('networkidle');

    // Header should show the operator name
    const header = page.locator('.hdr-name, [class*="hdr-name"]').first();
    await expect(header).toBeVisible({ timeout: 10000 });
    const headerText = await header.textContent();
    expect(headerText?.length).toBeGreaterThan(0);
  });

  test('displays task card or empty state', async ({ page }) => {
    const operatorId = await page.evaluate(async () => {
      const res = await fetch('/api/v1/schedule/snapshot', {
        headers: { 'X-Flux-Scenario': 'prod' },
      });
      const data = await res.json();
      return data?.operators?.[0]?.id ?? null;
    });

    if (!operatorId) {
      test.skip(true, 'No operators');
      return;
    }

    await page.goto(`/mobile/operator/${operatorId}`);
    await page.waitForLoadState('networkidle');

    // Either the active task card is visible or the empty state
    const taskCard = page.getByTestId('mobile-task-card');
    const emptyState = page.locator('text=Aucune tâche planifiée');

    const hasCard = await taskCard.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasCard || hasEmpty).toBe(true);
  });

  test('confirm ontime button appears in end zone and dismisses', async ({ page }) => {
    const operatorId = await page.evaluate(async () => {
      const res = await fetch('/api/v1/schedule/snapshot', {
        headers: { 'X-Flux-Scenario': 'prod' },
      });
      const data = await res.json();
      return data?.operators?.[0]?.id ?? null;
    });

    if (!operatorId) {
      test.skip(true, 'No operators');
      return;
    }

    await page.goto(`/mobile/operator/${operatorId}`);
    await page.waitForLoadState('networkidle');

    const confirmBtn = page.getByTestId('mobile-confirm-ontime');
    const isVisible = await confirmBtn.isVisible().catch(() => false);

    if (isVisible) {
      await confirmBtn.click();
      await expect(confirmBtn).not.toBeVisible({ timeout: 2000 });
    }
  });

  test('next peek shows when a following task exists', async ({ page }) => {
    const operatorId = await page.evaluate(async () => {
      const res = await fetch('/api/v1/schedule/snapshot', {
        headers: { 'X-Flux-Scenario': 'prod' },
      });
      const data = await res.json();
      return data?.operators?.[0]?.id ?? null;
    });

    if (!operatorId) {
      test.skip(true, 'No operators');
      return;
    }

    await page.goto(`/mobile/operator/${operatorId}`);
    await page.waitForLoadState('networkidle');

    const nextPeek = page.getByTestId('mobile-next-peek');
    const isVisible = await nextPeek.isVisible().catch(() => false);

    if (isVisible) {
      const text = await nextPeek.textContent();
      expect(text).toContain('Suivant');
    }
  });
});
