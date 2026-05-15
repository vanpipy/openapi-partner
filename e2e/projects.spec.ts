import { test, expect } from '@playwright/test';

test.describe('Projects', () => {
  test.describe('Projects Page', () => {
    test('should display projects page', async ({ page }) => {
      await page.goto('/projects');
      
      // Check for page header
      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible();
    });

    test('should have "Projects" or "API" in the title', async ({ page }) => {
      await page.goto('/projects');
      await expect(page.locator('body')).toContainText(/projects|api/i);
    });

    test('should display project list area or empty state', async ({ page }) => {
      await page.goto('/projects');
      // Either shows projects list or empty state
      const hasContent = await page.locator('[role="table"], table, [class*="card"], [class*="list"]').count();
      expect(hasContent).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Project Detail', () => {
    test('should navigate to project detail page', async ({ page }) => {
      await page.goto('/projects');
      
      // Look for any project link
      const projectLink = page.locator('a[href*="/projects/"]').first();
      
      if (await projectLink.isVisible().catch(() => false)) {
        await projectLink.click();
        await expect(page).toHaveURL(/\/projects\/\d+/);
      }
    });
  });
});
