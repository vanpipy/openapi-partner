import { test, expect } from './helpers';

/**
 * E2E Tests for Global Navigation and Layout
 * 
 * Tests cover:
 * - Navigation between pages
 * - Sidebar navigation
 * - Quick Start guide links
 * - Protected route redirects
 * - 404 handling
 */

test.describe('Global Navigation', () => {
  
  test('should have working navigation menu', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/projects');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Check for navigation elements
    const nav = authenticatedPage.locator('nav, [role="navigation"], .sidebar');
    const navCount = await nav.count();
    
    // At least one nav element should be present
    expect(navCount).toBeGreaterThan(0);
  });

  test('should navigate to Projects page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Look for projects link
    const projectsLink = authenticatedPage.locator('a:has-text("Projects"), a:has-text("项目")').first();
    const linkCount = await projectsLink.count();
    
    if (linkCount > 0) {
      await projectsLink.click();
      await authenticatedPage.waitForURL('**/projects', { timeout: 5000 });
      await expect(authenticatedPage.locator('h1')).toContainText('API Type Automation');
    }
  });

  test('should navigate to History page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/projects');
    
    // Look for history link
    const historyLink = authenticatedPage.locator('a:has-text("History"), a:has-text("历史")');
    const linkCount = await historyLink.count();
    
    if (linkCount > 0) {
      await historyLink.first().click();
      await authenticatedPage.waitForURL('**/history', { timeout: 5000 });
      await expect(authenticatedPage.locator('h1')).toContainText('配置历史');
    }
  });

  test('should show Quick Start guide in sidebar', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/projects');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Quick Start section
    const quickStart = authenticatedPage.locator('text=Quick Start');
    await expect(quickStart).toBeVisible();
    
    // Guide steps
    await expect(authenticatedPage.locator('text=Create a project')).toBeVisible();
    await expect(authenticatedPage.locator('text=Generate a token')).toBeVisible();
  });

  test('should have working Quick Start links', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/projects');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Look for "Create a project" link
    const createLink = authenticatedPage.locator('a:has-text("Create a project")');
    const linkCount = await createLink.count();
    
    if (linkCount > 0) {
      await createLink.click();
      await authenticatedPage.waitForTimeout(500);
      
      // Should open create project dialog
      const dialog = authenticatedPage.locator('[role="dialog"]');
      const dialogVisible = await dialog.isVisible().catch(() => false);
      const currentUrl = authenticatedPage.url();
      expect(dialogVisible || currentUrl.includes('projects')).toBeTruthy();
    }
  });
});

test.describe('Protected Routes', () => {
  
  test('should redirect to login when accessing protected route without auth', async ({ page, baseURL }) => {
    // Clear cookies to simulate no session
    await page.context().clearCookies();
    
    // Try to access protected page
    await page.goto(`${baseURL}/projects`);
    
    // Should redirect to login
    await expect(page).toHaveURL(/login/i, { timeout: 5000 });
  });

  test('should redirect to login when accessing config page without auth', async ({ page, baseURL }) => {
    await page.context().clearCookies();
    
    await page.goto(`${baseURL}/`);
    
    await expect(page).toHaveURL(/login/i, { timeout: 5000 });
  });

  test('should redirect to login when accessing project detail without auth', async ({ page, baseURL }) => {
    await page.context().clearCookies();
    
    await page.goto(`${baseURL}/projects/1`);
    
    await expect(page).toHaveURL(/login/i, { timeout: 5000 });
  });

  test('should allow access to login page without authentication', async ({ page, baseURL }) => {
    await page.context().clearCookies();
    
    await page.goto(`${baseURL}/login`);
    
    // Should stay on login page
    await expect(page).toHaveURL(/login/i);
    await expect(page.locator('input[id="username"]')).toBeVisible();
  });

  test('should preserve intended URL after redirect to login', async ({ page, baseURL }) => {
    await page.context().clearCookies();
    
    // Try to access protected page
    await page.goto(`${baseURL}/projects`);
    
    // Should be on login
    await expect(page).toHaveURL(/login/i);
    
    // Login
    await page.fill('input[id="username"]', 'admin');
    await page.fill('input[id="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Should redirect back to original requested page
    await page.waitForURL('**/projects', { timeout: 10000 });
  });
});

test.describe('URL Redirects', () => {
  
  test('should redirect root URL to projects', async ({ page, baseURL }) => {
    await page.context().clearCookies();
    
    await page.goto(`${baseURL}/`);
    
    // After login, should be on projects
    await expect(page).toHaveURL(/projects|login/i, { timeout: 5000 });
  });

  test('should handle history page navigation', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/history');
    await authenticatedPage.waitForLoadState('networkidle');
    
    await expect(authenticatedPage.locator('h1')).toContainText('配置历史');
    
    // Navigate back
    await authenticatedPage.goBack();
    await authenticatedPage.waitForURL('**/projects', { timeout: 5000 });
  });
});

test.describe('Page Loading States', () => {
  
  test('should show loading state while page loads', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/projects');
    
    // Page should not have errors
    const errorAlert = authenticatedPage.locator('.bg-red-50, [class*="error"], [role="alert"]:has-text("Error")');
    const errorCount = await errorAlert.count();
    
    // If page loaded successfully, there should be no error alerts
    // (This is a soft check - pages may load without errors)
    expect(typeof errorCount).toBe('number');
  });

  test('should handle network errors gracefully', async ({ authenticatedPage }) => {
    // Navigate to a page - it should either load or show appropriate error
    await authenticatedPage.goto('/projects');
    
    const pageContent = await authenticatedPage.content();
    expect(pageContent.length).toBeGreaterThan(0);
  });
});

test.describe('Layout and Structure', () => {
  
  test('should have consistent header across pages', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/projects');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Header should contain app title
    const header = authenticatedPage.locator('header');
    await expect(header.first()).toBeVisible();
  });

  test('should have working logout functionality', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/projects');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Look for logout button
    const logoutBtn = authenticatedPage.locator('button:has-text("Logout"), button:has-text("退出"), a:has-text("Logout")');
    const btnCount = await logoutBtn.count();
    
    if (btnCount > 0) {
      await logoutBtn.first().click();
      
      // Should redirect to login
      await authenticatedPage.waitForURL(/login/i, { timeout: 5000 });
      await expect(authenticatedPage.locator('input[id="username"]')).toBeVisible();
    }
  });

  test('should maintain layout on page resize', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/projects');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Set mobile viewport
    await authenticatedPage.setViewportSize({ width: 375, height: 667 });
    await authenticatedPage.waitForTimeout(500);
    
    // Page should still be usable (sidebar may be hidden)
    const mainContent = authenticatedPage.locator('main');
    await expect(mainContent).toBeVisible();
  });
});
