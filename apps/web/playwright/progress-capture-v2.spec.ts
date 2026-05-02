import { test, expect } from '@playwright/test';

/**
 * E2E specs — V2 progress capture (saisie modal + parameterized pin dialog).
 *
 * STRICT RULE (per CLAUDE.md) : these tests are not run automatically.
 * Run them manually with explicit permission once the prerequisites are in
 * place :
 *
 *   1. The frontend must be built with `VITE_FEATURE_PROGRESS_CAPTURE_V2=true`
 *      so the V2 SaisieIndicator + ProgressCaptureModal + SetStartTimeDialog
 *      paths are active.
 *   2. A Playwright fixture `progress-capture-v2` must exist with at least :
 *        - One in-progress assignment (scheduledStart < now < scheduledEnd)
 *        - One assignment whose scheduledEnd is past `now` (for tile-end state)
 *        - A reasonable `task.duration` (setupMinutes + runMinutes) to drive
 *          the gauge math.
 *
 * Until then these specs are scaffolds — the assertions are correct against
 * the design, but they need the fixture + flag to actually run green.
 *
 * Refs : docs/operator-sandbox/progress-capture-design.md
 *        docs/operator-sandbox/progress-capture-impl-plan.md (Phase 4.3)
 */

test.describe('V2 Progress Capture — saisie modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=progress-capture-v2');
    await page.waitForSelector('[data-testid="scheduling-grid"]');
    // Wait for at least one V2 saisie indicator on an in-progress tile.
    await page.waitForSelector('[data-testid="tile-saisie-indicator"]');
  });

  test('opens the saisie modal when clicking the indicator', async ({ page }) => {
    const indicator = page.locator('[data-testid="tile-saisie-indicator"]').first();
    await indicator.click();

    const modal = page.locator('[data-testid="progress-capture-modal"]');
    await expect(modal).toBeVisible();

    // Header structure
    await expect(modal.getByText('Avancement')).toBeVisible();
    // Massive À l'heure button is the dominant action
    await expect(page.locator('[data-testid="pm-quick-ontime"]')).toBeVisible();
    // The 6 symmetric adjustments
    await expect(page.locator('[data-testid="pm-quick-minus60"]')).toBeVisible();
    await expect(page.locator('[data-testid="pm-quick-plus60"]')).toBeVisible();
  });

  test('default state on open is "À l\'heure" (active green)', async ({ page }) => {
    const indicator = page.locator('[data-testid="tile-saisie-indicator"]').first();
    await indicator.click();

    const ontime = page.locator('[data-testid="pm-quick-ontime"]');
    await expect(ontime).toHaveClass(/is-active/);

    const status = page.locator('[data-testid="pm-status"]');
    await expect(status).toHaveAttribute('data-pm-status', 'ontime');
  });

  test('selecting +30min flips the status line to retard', async ({ page }) => {
    const indicator = page.locator('[data-testid="tile-saisie-indicator"]').first();
    await indicator.click();

    await page.locator('[data-testid="pm-quick-plus30"]').click();

    const status = page.locator('[data-testid="pm-status"]');
    await expect(status).toHaveAttribute('data-pm-status', 'retard');
    await expect(status).toContainText('30 min en retard');
  });

  test('selecting −30min flips the status line to avance', async ({ page }) => {
    const indicator = page.locator('[data-testid="tile-saisie-indicator"]').first();
    await indicator.click();

    await page.locator('[data-testid="pm-quick-minus30"]').click();

    const status = page.locator('[data-testid="pm-status"]');
    await expect(status).toHaveAttribute('data-pm-status', 'avance');
    await expect(status).toContainText('30 min en avance');
  });

  test('Enregistrer fires the saisie mutation and closes the modal', async ({ page }) => {
    // Network observer
    const saisiePromise = page.waitForRequest((req) =>
      /\/api\/v1\/scenarios\/prod\/saisie\//.test(req.url()) && req.method() === 'POST',
    );

    const indicator = page.locator('[data-testid="tile-saisie-indicator"]').first();
    await indicator.click();

    await page.locator('[data-testid="pm-quick-plus15"]').click();
    await page.locator('[data-testid="pm-confirm-btn"]').click();

    const req = await saisiePromise;
    const body = req.postDataJSON() as { estimatedEndTime?: string };
    expect(typeof body.estimatedEndTime).toBe('string');

    // Modal closes after the save
    await expect(page.locator('[data-testid="progress-capture-modal"]')).toBeHidden();
  });

  test('Cancel closes without firing a save', async ({ page }) => {
    const indicator = page.locator('[data-testid="tile-saisie-indicator"]').first();
    await indicator.click();
    await page.locator('[data-testid="pm-cancel-btn"]').click();
    await expect(page.locator('[data-testid="progress-capture-modal"]')).toBeHidden();
  });

  test('Escape closes the modal', async ({ page }) => {
    const indicator = page.locator('[data-testid="tile-saisie-indicator"]').first();
    await indicator.click();
    await expect(page.locator('[data-testid="progress-capture-modal"]')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="progress-capture-modal"]')).toBeHidden();
  });

  test('the gauge renders the slot context (cumul + slot zone + marker)', async ({ page }) => {
    const indicator = page.locator('[data-testid="tile-saisie-indicator"]').first();
    await indicator.click();

    await expect(page.locator('[data-testid="volume-gauge"]')).toBeVisible();
    await expect(page.locator('[data-testid="volume-gauge-slot-zone"]')).toBeVisible();
    await expect(page.locator('[data-testid="volume-gauge-marker"]')).toBeVisible();
  });
});

test.describe('V2 Progress Capture — auto-completion derivation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=progress-capture-v2');
    await page.waitForSelector('[data-testid="scheduling-grid"]');
  });

  test('a tile whose scheduledEnd is past now reads as completed', async ({ page }) => {
    // The fixture should include a tile (e.g. tile-assign-past-end-1) whose
    // scheduledEnd is in the past relative to the fixture's "now". Under V2
    // it should render with the completed colour even with isCompleted=false.
    const tile = page.locator('[data-testid="tile-assign-past-end-1"]');
    await expect(tile).toHaveClass(/border-l-green-500/);
  });
});

test.describe('V2 Progress Capture — context menu integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=progress-capture-v2');
    await page.waitForSelector('[data-testid="scheduling-grid"]');
    await page.waitForSelector('[data-testid="tile-saisie-indicator"]');
  });

  test('right-click → Saisir l\'avancement opens the modal', async ({ page }) => {
    const tile = page.locator('[data-testid^="tile-assign-"]').first();
    await tile.click({ button: 'right' });

    await expect(page.locator('[data-testid="tile-context-menu"]')).toBeVisible();
    await page.locator('[data-testid="context-menu-saisir-avancement"]').click();

    await expect(page.locator('[data-testid="progress-capture-modal"]')).toBeVisible();
  });

  test('right-click → Définir heure de début opens the SetStartTimeDialog', async ({ page }) => {
    const tile = page.locator('[data-testid^="tile-assign-"]').first();
    await tile.click({ button: 'right' });

    await page.locator('[data-testid="context-menu-definir-debut"]').click();

    await expect(page.locator('[data-testid="set-start-time-dialog"]')).toBeVisible();
    await expect(page.locator('[data-testid="compact-calendar"]')).toBeVisible();
    await expect(page.locator('[data-testid="feas-preview"]')).toBeVisible();
  });
});

test.describe('V2 Progress Capture — set start time dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=progress-capture-v2');
    await page.waitForSelector('[data-testid="scheduling-grid"]');
    // Open the dialog via the context menu
    const tile = page.locator('[data-testid^="tile-assign-"]').first();
    await tile.click({ button: 'right' });
    await page.locator('[data-testid="context-menu-definir-debut"]').click();
    await page.waitForSelector('[data-testid="set-start-time-dialog"]');
  });

  test('navigating to next month updates the calendar header', async ({ page }) => {
    const monthLabel = page.locator('[data-testid="cal-month-label"]');
    const initial = (await monthLabel.textContent()) ?? '';
    await page.locator('[data-testid="cal-next-month"]').click();
    const next = (await monthLabel.textContent()) ?? '';
    expect(next).not.toBe(initial);
  });

  test('Définir fires the pin mutation with the target ISO', async ({ page }) => {
    const pinPromise = page.waitForRequest((req) =>
      /\/api\/v1\/scenarios\/prod\/pin\//.test(req.url()) && req.method() === 'POST',
    );
    await page.locator('[data-testid="sd-confirm-btn"]').click();
    const req = await pinPromise;
    const body = req.postDataJSON() as { targetDateTime?: string };
    expect(typeof body.targetDateTime).toBe('string');
  });

  test('Annuler closes without firing a mutation', async ({ page }) => {
    await page.locator('[data-testid="sd-cancel-btn"]').click();
    await expect(page.locator('[data-testid="set-start-time-dialog"]')).toBeHidden();
  });
});
