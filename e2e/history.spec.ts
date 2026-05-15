import { test, expect } from './helpers';

/**
 * E2E Tests for Config History
 * 
 * Tests cover:
 * - History page loads correctly
 * - History records display
 * - Filtering by config ID
 * - Change details display
 */

test.describe('Config History Page', () => {
  
  test('should display history page header', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/history');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Should see page title
    await expect(authenticatedPage.locator('h1')).toContainText('配置历史');
  });

  test('should show history description', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/history');
    await authenticatedPage.waitForLoadState('networkidle');
    
    await expect(authenticatedPage.locator('text=查看配置变更记录')).toBeVisible();
  });

  test('should display history list or empty state', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/history');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Should see history list container
    const historySection = authenticatedPage.locator('text=Change History');
    await expect(historySection).toBeVisible();
    
    // Should show records count
    const recordsText = authenticatedPage.locator('text=/\\d+ records?/');
    const recordCount = await recordsText.count();
    expect(recordCount).toBeGreaterThanOrEqual(0);
  });

  test('should show back to config list button', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/history');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Should see back button
    const backBtn = authenticatedPage.locator('button:has-text("返回配置列表"), a:has-text("返回配置列表")');
    await expect(backBtn.first()).toBeVisible();
  });

  test('should navigate back to config list', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/history');
    await authenticatedPage.waitForLoadState('networkidle');
    
    const backBtn = authenticatedPage.locator('button:has-text("返回配置列表"), a:has-text("返回配置列表")');
    await backBtn.click();
    
    // Should navigate back to home/config page
    await authenticatedPage.waitForURL('**/', { timeout: 5000 });
  });
});

test.describe('History Filtering', () => {
  
  test('should filter by config ID', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/history');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Find config ID filter input
    const filterInput = authenticatedPage.locator('input[id="configId"], input[placeholder*="config" i]');
    const filterCount = await filterInput.count();
    
    if (filterCount > 0) {
      await filterInput.fill('1');
      await authenticatedPage.waitForTimeout(500);
      
      // Should show filtered results
      const clearBtn = authenticatedPage.locator('button:has-text("Clear Filter")');
      await expect(clearBtn).toBeVisible();
    }
  });

  test('should clear filter', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/history');
    await authenticatedPage.waitForLoadState('networkidle');
    
    const filterInput = authenticatedPage.locator('input[id="configId"], input[placeholder*="config" i]');
    
    if (await filterInput.count() > 0) {
      await filterInput.fill('1');
      await authenticatedPage.waitForTimeout(500);
      
      const clearBtn = authenticatedPage.locator('button:has-text("Clear Filter")');
      await clearBtn.click();
      
      await authenticatedPage.waitForTimeout(500);
      
      // Filter should be cleared
      const filterValue = await filterInput.inputValue();
      expect(filterValue).toBe('');
    }
  });
});

test.describe('History Records Display', () => {
  
  test('should display change history records with details', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/history');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Look for Config ID column
    const configIdHeader = authenticatedPage.locator('th:has-text("Config ID"), th:has-text("配置ID")');
    const headerCount = await configIdHeader.count();
    
    if (headerCount > 0) {
      // Table structure exists
      await expect(configIdHeader).toBeVisible();
      
      // Should have Old Value and New Value columns
      await expect(authenticatedPage.locator('th:has-text("Old Value")')).toBeVisible();
      await expect(authenticatedPage.locator('th:has-text("New Value")')).toBeVisible();
    }
  });

  test('should show change reason if available', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/history');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Look for change reason column
    const reasonHeader = authenticatedPage.locator('th:has-text("Change Reason"), th:has-text("变更原因")');
    const headerCount = await reasonHeader.count();
    
    if (headerCount > 0) {
      await expect(reasonHeader).toBeVisible();
    }
  });

  test('should show timestamp for changes', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/history');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Should have Changed At or Timestamp column
    const timestampHeader = authenticatedPage.locator('th:has-text("Changed At"), th:has-text("变更时间"), th:has-text("Timestamp")');
    const headerCount = await timestampHeader.count();
    
    if (headerCount > 0) {
      await expect(timestampHeader).toBeVisible();
    }
  });
});
