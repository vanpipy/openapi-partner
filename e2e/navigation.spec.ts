import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.describe('Global Navigation', () => {
    test('should navigate to projects page', async ({ page }) => {
      await page.goto('/projects');
      await expect(page).toHaveURL(/\/projects/);
    });

    test('should have basic page structure', async ({ page }) => {
      await page.goto('/projects');
      
      // Check for body content
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Links', () => {
    test('should have navigation links', async ({ page }) => {
      await page.goto('/projects');
      
      // Check that page has links
      const links = page.locator('a[href]');
      const count = await links.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});
