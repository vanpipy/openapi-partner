import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing cookies/sessions
    await page.context().clearCookies();
  });

  test.describe('Login Page', () => {
    test('should display login page', async ({ page }) => {
      await page.goto('/login');
      // The page has heading "登录配置平台" (Login Config Platform)
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('should have username input field', async ({ page }) => {
      await page.goto('/login');
      const usernameInput = page.locator('input[name="username"], input[type="text"]').first();
      await expect(usernameInput).toBeVisible();
    });

    test('should have password input field', async ({ page }) => {
      await page.goto('/login');
      const passwordInput = page.locator('input[type="password"]').first();
      await expect(passwordInput).toBeVisible();
    });

    test('should have submit button', async ({ page }) => {
      await page.goto('/login');
      const submitButton = page.locator('button[type="submit"]').first();
      await expect(submitButton).toBeVisible();
    });
  });
});
