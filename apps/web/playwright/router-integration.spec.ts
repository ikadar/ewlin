/**
 * E2E tests for React Router integration (v0.4.38)
 *
 * Tests URL-based navigation, deep linking, and browser history support.
 */

import { test, expect } from '@playwright/test';

test.describe('React Router Integration', () => {
  test.describe('URL-Based Job Selection', () => {
    test('clicking a job updates the URL to /job/:jobId', async ({ page }) => {
      // Load app with fixture
      await page.goto('/?fixture=test');
      await page.waitForSelector('[data-testid="jobs-list"]');

      // Get the first job card
      const firstJobCard = page.locator('[data-testid^="job-card-"]').first();
      const jobId = await firstJobCard.getAttribute('data-testid');
      const extractedJobId = jobId?.replace('job-card-', '');

      // Click on the job
      await firstJobCard.click();

      // Verify URL changed
      await expect(page).toHaveURL(new RegExp(`/job/${extractedJobId}`));
    });

    test('direct navigation to /job/:jobId selects the job', async ({ page }) => {
      // Navigate directly to a job URL with fixture
      await page.goto('/job/job-test-1?fixture=test');
      await page.waitForSelector('[data-testid="jobs-list"]');

      // Verify job details panel is shown (indicates a job is selected)
      const detailsPanel = page.locator('[data-testid="job-details-panel"]');
      await expect(detailsPanel).toBeVisible();
    });

    test('navigating to / deselects the job', async ({ page }) => {
      // Start with a selected job
      await page.goto('/job/job-test-1?fixture=test');
      await page.waitForSelector('[data-testid="job-details-panel"]');

      // Navigate to root
      await page.goto('/?fixture=test');

      // Verify no job is selected (details panel closed or empty)
      const detailsPanel = page.locator('[data-testid="job-details-panel"]');
      await expect(detailsPanel).not.toBeVisible();
    });
  });

  test.describe('JCF Modal Route', () => {
    test('navigating to /job/new opens the JCF modal', async ({ page }) => {
      // Navigate directly to /job/new
      await page.goto('/job/new?fixture=test');
      await page.waitForSelector('[data-testid="jobs-list"]');

      // Verify JCF modal is open
      const jcfModal = page.locator('[data-testid="jcf-modal-dialog"]');
      await expect(jcfModal).toBeVisible();
    });

    test('clicking "+" button navigates to /job/new', async ({ page }) => {
      // Load app
      await page.goto('/?fixture=test');
      await page.waitForSelector('[data-testid="jobs-list"]');

      // Click the add job button (uses aria-label)
      const addButton = page.locator('[aria-label="Ajouter un travail"]');
      await addButton.click();

      // Verify URL changed
      await expect(page).toHaveURL(/\/job\/new/);

      // Verify modal is open
      const jcfModal = page.locator('[data-testid="jcf-modal-dialog"]');
      await expect(jcfModal).toBeVisible();
    });

    test('closing JCF modal navigates back to /', async ({ page }) => {
      // Open JCF modal via URL
      await page.goto('/job/new?fixture=test');
      await page.waitForSelector('[data-testid="jcf-modal-dialog"]');

      // Close the modal (click X button)
      const closeButton = page.locator('[data-testid="jcf-modal-close"]');
      await closeButton.click();

      // Verify URL changed back to root
      await expect(page).toHaveURL(/^[^?]*\/(\?|$)/);

      // Verify modal is closed
      const jcfModal = page.locator('[data-testid="jcf-modal-dialog"]');
      await expect(jcfModal).not.toBeVisible();
    });
  });

  test.describe('Browser History Support', () => {
    test('browser back button returns to previous view', async ({ page }) => {
      // Load app
      await page.goto('/?fixture=test');
      await page.waitForSelector('[data-testid="jobs-list"]');

      // Click add button to open JCF modal
      const addButton = page.locator('[aria-label="Ajouter un travail"]');
      await addButton.click();
      await expect(page).toHaveURL(/\/job\/new/);

      // Go back
      await page.goBack();

      // Should be at root URL
      await expect(page).toHaveURL(/^[^?]*\/(\?|$)/);

      // Modal should be closed
      const jcfModal = page.locator('[data-testid="jcf-modal-dialog"]');
      await expect(jcfModal).not.toBeVisible();
    });

    test('browser forward button restores view', async ({ page }) => {
      // Load app
      await page.goto('/?fixture=test');
      await page.waitForSelector('[data-testid="jobs-list"]');

      // Click add button to open JCF modal
      const addButton = page.locator('[aria-label="Ajouter un travail"]');
      await addButton.click();
      await expect(page).toHaveURL(/\/job\/new/);

      // Go back to root
      await page.goBack();
      await expect(page).toHaveURL(/^[^?]*\/(\?|$)/);

      // Go forward
      await page.goForward();

      // Should be at /job/new again
      await expect(page).toHaveURL(/\/job\/new/);

      // Modal should be open
      const jcfModal = page.locator('[data-testid="jcf-modal-dialog"]');
      await expect(jcfModal).toBeVisible();
    });
  });

  test.describe('Deep Link Support', () => {
    test('direct URL to job shows job details', async ({ page }) => {
      // Navigate directly to a job
      await page.goto('/job/job-test-1?fixture=test');
      await page.waitForSelector('[data-testid="jobs-list"]');

      // Job details panel should be visible
      const detailsPanel = page.locator('[data-testid="job-details-panel"]');
      await expect(detailsPanel).toBeVisible();
    });

    test('direct URL to /job/new shows JCF modal', async ({ page }) => {
      // Navigate directly to /job/new
      await page.goto('/job/new?fixture=test');
      await page.waitForSelector('[data-testid="jobs-list"]');

      // JCF modal should be open
      const jcfModal = page.locator('[data-testid="jcf-modal-dialog"]');
      await expect(jcfModal).toBeVisible();
    });

    test('invalid job ID handles gracefully', async ({ page }) => {
      // Navigate to a non-existent job
      await page.goto('/job/invalid-job-id?fixture=test');
      await page.waitForSelector('[data-testid="jobs-list"]');

      // App should still load (job details panel not visible for invalid job)
      const jobsList = page.locator('[data-testid="jobs-list"]');
      await expect(jobsList).toBeVisible();
    });
  });
});
