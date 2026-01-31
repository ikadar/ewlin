/**
 * Playwright JCF Sequence Autocomplete E2E Tests
 *
 * Tests for v0.4.20: Multi-line sequence editor with poste mode.
 * Tests for v0.4.21: ST (sous-traitant) mode.
 * Tests for v0.4.22: Workflow-guided suggestion ordering.
 * Tests for v0.4.31: Template-free mode (no workflow, no star markers).
 * Verifies poste selection, duration input, multi-line editing,
 * keyboard navigation, ST name/duration/description flow,
 * and workflow priority sorting.
 *
 * Sequence is row index 11 (last row) in the elements table.
 *
 * @see docs/releases/v0.4.20-jcf-sequence-poste-mode.md
 * @see docs/releases/v0.4.21-jcf-sequence-st-mode.md
 * @see docs/releases/v0.4.22-jcf-sequence-workflow-suggestions.md
 * @see docs/releases/v0.4.31-sequence-template-free-mode.md
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/drag';

test.describe('v0.4.20: JCF Sequence Autocomplete', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=test');
    await waitForAppReady(page);

    // Open JCF modal
    const addButton = page.locator('button[aria-label="Ajouter un travail"]');
    await addButton.click();
    await expect(
      page.locator('[data-testid="jcf-modal-backdrop"]'),
    ).toBeVisible();
  });

  test.describe('poste name selection', () => {
    test('shows poste name suggestions on focus', async ({ page }) => {
      // Focus the sequence cell (row 11, element 0)
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();

      // Dropdown should appear with poste names (portal-based)
      const dropdown = page.locator('[data-testid="cell-0-11-dropdown"]');
      await expect(dropdown).toBeVisible();
      await expect(dropdown).toContainText('G37');
      await expect(dropdown).toContainText('Stahl');
    });

    test('shows category descriptions in dropdown', async ({ page }) => {
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();

      const dropdown = page.locator('[data-testid="cell-0-11-dropdown"]');
      await expect(dropdown).toBeVisible();
      await expect(dropdown).toContainText('Presse offset');
      await expect(dropdown).toContainText('Plieuse');
    });

    test('shows ST: option in poste suggestions', async ({ page }) => {
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();

      // Type "st" to filter to ST: option (otherwise it's beyond lazy load limit)
      await sequenceTextarea.fill('st');

      const dropdown = page.locator('[data-testid="cell-0-11-dropdown"]');
      await expect(dropdown).toBeVisible();
      await expect(dropdown).toContainText('ST:');
      await expect(dropdown).toContainText('Sous-traitant');
    });

    test('selecting poste inserts name with open paren', async ({ page }) => {
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();

      // Select first poste via Enter
      await page.keyboard.press('Enter');

      // Textarea should contain poste name + open paren
      const value = await sequenceTextarea.inputValue();
      expect(value).toContain('(');
    });
  });

  // Note: Duration suggestions for postes were removed - users type duration manually.
  // Only ST mode has duration suggestions.

  test.describe('multi-line editing', () => {
    test('supports multiple lines with independent autocomplete', async ({
      page,
    }) => {
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();

      // Type first complete line
      await sequenceTextarea.fill('G37(20)');

      // Press Enter to add new line, then type filter text
      await page.keyboard.press('Enter');
      // Type "ahl" which only matches "Stahl" (not "ST:")
      await page.keyboard.type('ahl');

      const dropdown = page.locator('[data-testid="cell-0-11-dropdown"]');
      await expect(dropdown).toBeVisible();
      await expect(dropdown).toContainText('Stahl');
    });
  });

  test.describe('keyboard navigation', () => {
    test('Escape closes dropdown', async ({ page }) => {
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();

      const dropdown = page.locator('[data-testid="cell-0-11-dropdown"]');
      await expect(dropdown).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(dropdown).not.toBeVisible();

      // Modal should still be open
      await expect(
        page.locator('[data-testid="jcf-modal-backdrop"]'),
      ).toBeVisible();
    });

    test('Tab delegates to table navigation', async ({ page }) => {
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();

      // Sequence is last row (index 11). Tab should NOT move within table
      // (no more rows below). Tab behavior at boundary depends on element count.
      // With single element, Tab at last cell should allow native Tab out.
      // We just verify Tab doesn't break.
      await page.keyboard.press('Tab');

      // Focus should have moved away from sequence cell
      const focusedId = await page.evaluate(
        () => document.activeElement?.id,
      );
      // Not asserting specific target since it depends on boundary behavior
      expect(focusedId).not.toBe('cell-0-11');
    });
  });

  test.describe('filtering', () => {
    test('typing filters poste suggestions', async ({ page }) => {
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();
      await sequenceTextarea.fill('G');

      const dropdown = page.locator('[data-testid="cell-0-11-dropdown"]');
      await expect(dropdown).toBeVisible();
      await expect(dropdown).toContainText('G37');
      await expect(dropdown).toContainText('GTO');
      // Non-matching should not appear
      const text = await dropdown.textContent();
      expect(text).not.toContain('Stahl');
    });
  });

  test.describe('v0.4.21: ST mode', () => {
    test('shows sous-traitant names after typing ST:', async ({ page }) => {
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();
      await sequenceTextarea.fill('ST:');

      const dropdown = page.locator('[data-testid="cell-0-11-dropdown"]');
      await expect(dropdown).toBeVisible();
      await expect(dropdown).toContainText('MCA');
      await expect(dropdown).toContainText('F37');
      await expect(dropdown).toContainText('LGI');
    });

    test('filters ST names by typed text', async ({ page }) => {
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();
      await sequenceTextarea.fill('ST:MC');

      const dropdown = page.locator('[data-testid="cell-0-11-dropdown"]');
      await expect(dropdown).toBeVisible();
      await expect(dropdown).toContainText('MCA');
      const text = await dropdown.textContent();
      expect(text).not.toContain('LGI');
    });

    test('shows ST duration suggestions after name selection', async ({
      page,
    }) => {
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();
      await sequenceTextarea.fill('ST:MCA(');

      const dropdown = page.locator('[data-testid="cell-0-11-dropdown"]');
      await expect(dropdown).toBeVisible();
      await expect(dropdown).toContainText('1j)');
      await expect(dropdown).toContainText('3j)');
      await expect(dropdown).toContainText('5j)');
    });

    test('selecting ST duration completes structured part', async ({
      page,
    }) => {
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();
      await sequenceTextarea.fill('ST:MCA(');

      // Select first duration via Enter
      await page.keyboard.press('Enter');

      // Should contain ST:MCA(Nj):
      const value = await sequenceTextarea.inputValue();
      expect(value).toMatch(/^ST:MCA\(\d+j\):$/);
    });

    test('no dropdown shown during description typing', async ({ page }) => {
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();
      await sequenceTextarea.fill('ST:MCA(3j):dos carré');

      const dropdown = page.locator('[data-testid="cell-0-11-dropdown"]');
      await expect(dropdown).not.toBeVisible();
    });
  });

  /**
   * v0.4.22: Workflow-Guided Suggestions Tests
   *
   * When a test fixture is active (?fixture=test), the JCF elements table
   * receives a test workflow: ['Presse offset, Presse numérique', 'Massicot', 'Plieuse', 'Conditionnement']
   *
   * These tests verify:
   * - Priority postes (matching expected category) appear first
   * - Priority postes have star marker (★) in description badge
   * - Step advances after completing each line
   */
  test.describe('v0.4.22: Workflow-guided suggestions', () => {
    test('shows star marker for priority postes at step 0', async ({ page }) => {
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();

      const dropdown = page.locator('[data-testid="cell-0-11-dropdown"]');
      await expect(dropdown).toBeVisible();

      // At step 0, workflow expects "Presse offset, Presse numérique"
      // Postes in these categories should have star marker
      await expect(dropdown).toContainText('★ Presse offset');
    });

    test('priority postes appear first in dropdown', async ({ page }) => {
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();

      const dropdown = page.locator('[data-testid="cell-0-11-dropdown"]');
      await expect(dropdown).toBeVisible();

      // Get all suggestion items
      const items = dropdown.locator('div[class*="cursor-pointer"]');
      const firstItemText = await items.first().textContent();

      // First item should be a priority poste (Presse offset or Presse numérique machine)
      // These are G37, 754, GTO, C9500 in test data
      expect(firstItemText).toMatch(/G37|754|GTO|C9500/);
    });

    test('non-priority postes do not have star marker', async ({ page }) => {
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();

      const dropdown = page.locator('[data-testid="cell-0-11-dropdown"]');
      await expect(dropdown).toBeVisible();

      // Massicot, Plieuse, etc. should not have star at step 0
      // They should have plain category (no star)
      const text = await dropdown.textContent();
      expect(text).not.toContain('★ Massicot');
      expect(text).not.toContain('★ Plieuse');
    });

    test('step advances after completing first line', async ({ page }) => {
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();

      // Complete first line (step 0 → step 1)
      await sequenceTextarea.fill('G37(20)');
      await page.keyboard.press('Enter');

      // Now on step 1, workflow expects "Massicot"
      const dropdown = page.locator('[data-testid="cell-0-11-dropdown"]');
      await expect(dropdown).toBeVisible();

      // Massicot should now have star marker
      await expect(dropdown).toContainText('★ Massicot');

      // Presse offset should NOT have star anymore
      const text = await dropdown.textContent();
      expect(text).not.toContain('★ Presse offset');
    });

    test('workflow does not affect ST mode suggestions', async ({ page }) => {
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();
      await sequenceTextarea.fill('ST:');

      const dropdown = page.locator('[data-testid="cell-0-11-dropdown"]');
      await expect(dropdown).toBeVisible();

      // ST mode shows sous-traitant names, no star markers
      const text = await dropdown.textContent();
      expect(text).not.toContain('★');
      expect(text).toContain('Sous-traitant');
    });
  });
});

/**
 * v0.4.31: Template-Free Mode Tests
 *
 * When no template is selected (or no test fixture is active), the sequence
 * autocomplete should show all postes without workflow-based priority sorting
 * and without star markers.
 *
 * These tests verify:
 * - No star markers when no template is selected
 * - All postes shown equally (no priority sorting)
 * - Template selection activates workflow
 */
test.describe('v0.4.31: Template-Free Mode', () => {
  test.beforeEach(async ({ page }) => {
    // NO fixture - this is template-free mode
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open JCF modal
    const addButton = page.locator('button[aria-label="Ajouter un travail"]');
    await addButton.click();
    await expect(
      page.locator('[data-testid="jcf-modal-backdrop"]'),
    ).toBeVisible();
  });

  test('no star markers when no template selected', async ({ page }) => {
    // Template field should be empty
    const templateInput = page.locator('#jcf-template');
    await expect(templateInput).toHaveValue('');

    // Focus sequence cell
    const sequenceTextarea = page.locator('#cell-0-11');
    await sequenceTextarea.click();

    const dropdown = page.locator('[data-testid="cell-0-11-dropdown"]');
    await expect(dropdown).toBeVisible();

    // No star markers should appear in template-free mode
    const text = await dropdown.textContent();
    expect(text).not.toContain('★');
  });

  test('all postes shown in template-free mode', async ({ page }) => {
    const sequenceTextarea = page.locator('#cell-0-11');
    await sequenceTextarea.click();

    const dropdown = page.locator('[data-testid="cell-0-11-dropdown"]');
    await expect(dropdown).toBeVisible();

    // Should show postes from different categories (no filtering)
    await expect(dropdown).toContainText('G37'); // Presse offset
    await expect(dropdown).toContainText('P137'); // Massicot
    await expect(dropdown).toContainText('Stahl'); // Plieuse
  });

  test('selecting template activates workflow with star markers', async ({
    page,
  }) => {
    // Select a template with workflow
    const templateInput = page.locator('#jcf-template');
    await templateInput.click();
    await templateInput.fill('Brochure A4');

    // Select from dropdown
    const templateDropdown = page.locator('[data-testid="jcf-template-dropdown"]');
    await expect(templateDropdown).toBeVisible();
    await page.keyboard.press('Enter');

    // Now check sequence suggestions
    const sequenceTextarea = page.locator('#cell-0-11');
    await sequenceTextarea.click();

    const dropdown = page.locator('[data-testid="cell-0-11-dropdown"]');
    await expect(dropdown).toBeVisible();

    // With Brochure A4 template (workflow: ['Presse offset', 'Massicot', 'Plieuse', 'Conditionnement'])
    // Presse offset should have star marker at step 0
    await expect(dropdown).toContainText('★ Presse offset');
  });

  test('clearing template removes star markers', async ({ page }) => {
    // First select a template
    const templateInput = page.locator('#jcf-template');
    await templateInput.click();
    await templateInput.fill('Brochure A4');
    await page.keyboard.press('Enter');

    // Clear template
    await templateInput.fill('');

    // Check sequence suggestions
    const sequenceTextarea = page.locator('#cell-0-11');
    await sequenceTextarea.click();

    const dropdown = page.locator('[data-testid="cell-0-11-dropdown"]');
    await expect(dropdown).toBeVisible();

    // No star markers after clearing template
    const text = await dropdown.textContent();
    expect(text).not.toContain('★');
  });
});
