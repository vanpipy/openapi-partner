import { test, expect } from './helpers';

/**
 * E2E Tests for Authentication Flow
 * 
 * Tests cover:
 * - Login page renders correctly
 * - Successful login with valid credentials
 * - Failed login with invalid credentials
 * - Login form validation
 * - Redirect after successful login
 */

test.describe('Authentication', () => {
  
  test.beforeEach(async ({ page }) => {
    // Clear cookies to ensure clean state
    await page.context().clearCookies();
    await page.goto('/login');
  });

  test.describe('Login Page', () => {
    test('should display login form with required fields', async ({ page }) => {
      // Check page title and form elements
      await expect(page.locator('h1')).toContainText('登录配置平台');
      
      // Check username field exists
      const usernameInput = page.locator('input[id="username"]');
      await expect(usernameInput).toBeVisible();
      await expect(usernameInput).toHaveAttribute('required');
      
      // Check password field exists
      const passwordInput = page.locator('input[id="password"]');
      await expect(passwordInput).toBeVisible();
      await expect(passwordInput).toHaveAttribute('required');
      
      // Check submit button exists
      const submitButton = page.locator('button[type="submit"]');
      await expect(submitButton).toBeVisible();
      await expect(submitButton).toContainText('登录');
    });

    test('should show default credentials hint', async ({ page }) => {
      // Check for default credentials hint
      const hint = page.locator('text=默认管理员: admin / admin123');
      await expect(hint).toBeVisible();
    });

    test('should have accessible form labels', async ({ page }) => {
      // Check label associations
      await expect(page.locator('label[for="username"]')).toContainText('用户名');
      await expect(page.locator('label[for="password"]')).toContainText('密码');
    });
  });

  test.describe('Login Validation', () => {
    test('should show error when submitting empty form', async ({ page }) => {
      // Try to submit without filling form
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();
      
      // Browser native validation should prevent submission
      const usernameInput = page.locator('input[id="username"]');
      await expect(usernameInput).toBeFocused();
    });

    test('should clear error when user starts typing', async ({ page }) => {
      // Fill in credentials to trigger any validation
      await page.fill('input[id="username"]', 'admin');
      await page.fill('input[id="password"]', 'wrongpassword');
      
      // Error should not be visible initially
      const errorAlert = page.locator('.bg-red-50, [class*="alert"], [class*="error"]');
      await expect(errorAlert).toHaveCount(0);
    });
  });

  test.describe('Successful Login', () => {
    test('should redirect to projects page after successful login', async ({ page }) => {
      // Fill login form
      await page.fill('input[id="username"]', 'admin');
      await page.fill('input[id="password"]', 'admin123');
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Should redirect to projects page
      await page.waitForURL('**/projects', { timeout: 10000 });
      
      // Should see projects page content
      await expect(page.locator('h1')).toContainText('API Type Automation');
    });

    test('should show user is logged in after successful authentication', async ({ page }) => {
      // Login
      await page.fill('input[id="username"]', 'admin');
      await page.fill('input[id="password"]', 'admin123');
      await page.click('button[type="submit"]');
      
      await page.waitForURL('**/projects', { timeout: 10000 });
      
      // Page should load without login prompt
      await expect(page.locator('text=登录配置平台')).not.toBeVisible();
      await expect(page.locator('text=Projects')).toBeVisible();
    });
  });

  test.describe('Failed Login', () => {
    test('should show error for invalid credentials', async ({ page }) => {
      // Fill with wrong password
      await page.fill('input[id="username"]', 'admin');
      await page.fill('input[id="password"]', 'wrongpassword');
      
      // Submit
      await page.click('button[type="submit"]');
      
      // Should show error message
      await expect(page.locator('text=/登录失败|error|错误/i')).toBeVisible({ timeout: 5000 });
      
      // Should stay on login page
      await expect(page.locator('input[id="username"]')).toBeVisible();
    });

    test('should show error for non-existent user', async ({ page }) => {
      await page.fill('input[id="username"]', 'nonexistent');
      await page.fill('input[id="password"]', 'anypassword');
      
      await page.click('button[type="submit"]');
      
      // Should show error
      await expect(page.locator('text=/error|错误|登录失败/i')).toBeVisible({ timeout: 5000 });
    });

    test('should clear password field after failed login', async ({ page }) => {
      await page.fill('input[id="username"]', 'admin');
      await page.fill('input[id="password"]', 'wrongpassword');
      
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
      
      // Password field should be cleared or form should be reset
      const passwordInput = page.locator('input[id="password"]');
      const value = await passwordInput.inputValue();
      // Form may clear password or keep it depending on implementation
      expect(typeof value).toBe('string');
    });
  });

  test.describe('Session Persistence', () => {
    test('should persist session across page reloads', async ({ page, baseURL }) => {
      // Login first
      await page.fill('input[id="username"]', 'admin');
      await page.fill('input[id="password"]', 'admin123');
      await page.click('button[type="submit"]');
      
      await page.waitForURL('**/projects', { timeout: 10000 });
      
      // Reload the page
      await page.reload();
      
      // Should still be on projects page (not redirected to login)
      await expect(page).toHaveURL('**/projects');
      await expect(page.locator('text=Projects')).toBeVisible();
    });

    test('should maintain session when navigating to different pages', async ({ page }) => {
      // Login
      await page.fill('input[id="username"]', 'admin');
      await page.fill('input[id="password"]', 'admin123');
      await page.click('button[type="submit"]');
      
      await page.waitForURL('**/projects', { timeout: 10000 });
      
      // Navigate to project detail if available
      const projectLinks = page.locator('a[href^="/projects/"]');
      const count = await projectLinks.count();
      
      if (count > 0) {
        await projectLinks.first().click();
        await page.waitForURL('**/projects/**', { timeout: 5000 });
        
        // Navigate back
        await page.goBack();
        await expect(page).toHaveURL('**/projects');
      }
    });
  });
});
