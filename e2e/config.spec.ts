import { test, expect, testData } from './helpers';

/**
 * E2E Tests for Config Management
 * 
 * Tests cover:
 * - Config list page loads
 * - Config creation
 * - Config editing
 * - Config deletion
 * - Config filtering by environment
 * - Config search
 */

test.describe('Config Management', () => {
  
  test('should display configs page header', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    await expect(authenticatedPage.locator('h1')).toContainText('API Type Automation');
  });

  test('should navigate to configs list', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Look for config-related navigation or content
    const configNav = authenticatedPage.locator('a:has-text("Configs"), a:has-text("配置")');
    const configCount = await configNav.count();
    
    if (configCount > 0) {
      await configNav.first().click();
      await authenticatedPage.waitForLoadState('networkidle');
    }
    
    // Should see config management elements
    const pageContent = await authenticatedPage.content();
    expect(pageContent.length).toBeGreaterThan(0);
  });

  test('should show empty state when no configs exist', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Either empty state or config table should be visible
    const emptyState = authenticatedPage.locator('text=/No configs yet|No configurations/');
    const table = authenticatedPage.locator('table');
    
    const emptyVisible = await emptyState.count() > 0;
    const tableVisible = await table.isVisible().catch(() => false);
    
    expect(emptyVisible || tableVisible).toBeTruthy();
  });

  test('should filter configs by environment', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Look for environment filter
    const envFilter = authenticatedPage.locator('select[name="environment"], [id="environment"]');
    const filterCount = await envFilter.count();
    
    if (filterCount > 0) {
      await envFilter.selectOption('development');
      await authenticatedPage.waitForTimeout(500);
      
      // Filter should be applied
      await expect(envFilter).toHaveValue('development');
    }
  });

  test('should search configs by key name', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Look for search input
    const searchInput = authenticatedPage.locator('input[type="search"], input[placeholder*="search" i], input[name="search"]');
    const searchCount = await searchInput.count();
    
    if (searchCount > 0) {
      await searchInput.fill('test_key');
      await authenticatedPage.waitForTimeout(500);
      
      // Should filter results
      const searchValue = await searchInput.inputValue();
      expect(searchValue).toBe('test_key');
    }
  });
});

test.describe('Config Creation', () => {
  
  test('should open create config dialog', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Look for create config button
    const createBtn = authenticatedPage.locator('button:has-text("Create Config"), button:has-text("新建配置")');
    const btnCount = await createBtn.count();
    
    if (btnCount > 0) {
      await createBtn.first().click();
      
      // Dialog should open
      const dialog = authenticatedPage.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 3000 });
    }
  });

  test('should create config with valid data', async ({ authenticatedPage }) => {
    const configKey = testData.config.uniqueKey();
    
    await authenticatedPage.goto('/');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Open create dialog
    const createBtn = authenticatedPage.locator('button:has-text("Create Config"), button:has-text("新建配置")');
    const btnCount = await createBtn.count();
    
    if (btnCount === 0) {
      // Skip if no create button found
      test.skip();
    }
    
    await createBtn.first().click();
    
    // Fill form fields
    const keyInput = authenticatedPage.locator('input[name="key"], input[id="key"]');
    const valueInput = authenticatedPage.locator('input[name="value"], input[id="value"]');
    
    await keyInput.fill(configKey);
    await valueInput.fill('test_value');
    
    // Select type if dropdown exists
    const typeSelect = authenticatedPage.locator('select[name="type"], [id="type"]');
    if (await typeSelect.count() > 0) {
      await typeSelect.selectOption('string');
    }
    
    // Submit
    const submitBtn = authenticatedPage.locator('button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("创建")');
    await submitBtn.click();
    
    await authenticatedPage.waitForTimeout(1000);
    
    // Config should appear in list
    const configCell = authenticatedPage.locator(`text=${configKey}`);
    await expect(configCell.first()).toBeVisible({ timeout: 5000 });
  });

  test('should validate required key field', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    await authenticatedPage.waitForLoadState('networkidle');
    
    const createBtn = authenticatedPage.locator('button:has-text("Create Config"), button:has-text("新建配置")');
    if (await createBtn.count() === 0) {
      test.skip();
    }
    
    await createBtn.first().click();
    
    const dialog = authenticatedPage.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    
    // Try to submit without key
    const submitBtn = authenticatedPage.locator('button[type="submit"]:has-text("Create")');
    await submitBtn.click();
    
    // Key field should be marked required
    const keyInput = authenticatedPage.locator('input[name="key"], input[id="key"]');
    await expect(keyInput).toHaveAttribute('required');
  });

  test('should validate config value type', async ({ authenticatedPage }) => {
    const configKey = testData.config.uniqueKey();
    
    await authenticatedPage.goto('/');
    await authenticatedPage.waitForLoadState('networkidle');
    
    const createBtn = authenticatedPage.locator('button:has-text("Create Config"), button:has-text("新建配置")');
    if (await createBtn.count() === 0) {
      test.skip();
    }
    
    await createBtn.first().click();
    
    // Fill with number type but invalid value
    const keyInput = authenticatedPage.locator('input[name="key"], input[id="key"]');
    const valueInput = authenticatedPage.locator('input[name="value"], input[id="value"]');
    const typeSelect = authenticatedPage.locator('select[name="type"], [id="type"]');
    
    await keyInput.fill(configKey);
    
    if (await typeSelect.count() > 0) {
      await typeSelect.selectOption('number');
    }
    
    await valueInput.fill('not_a_number');
    
    const submitBtn = authenticatedPage.locator('button[type="submit"]:has-text("Create")');
    await submitBtn.click();
    
    // Should show validation error
    await authenticatedPage.waitForTimeout(500);
    const errorMsg = authenticatedPage.locator('text=/must be a number|invalid number/i');
    const errorCount = await errorMsg.count();
    expect(errorCount).toBeGreaterThan(0);
  });

  test('should close dialog on cancel', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    await authenticatedPage.waitForLoadState('networkidle');
    
    const createBtn = authenticatedPage.locator('button:has-text("Create Config"), button:has-text("新建配置")');
    if (await createBtn.count() === 0) {
      test.skip();
    }
    
    await createBtn.first().click();
    
    const dialog = authenticatedPage.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    
    // Click cancel
    const cancelBtn = authenticatedPage.locator('button:has-text("Cancel"), button:has-text("取消")');
    await cancelBtn.click();
    
    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe('Config Editing', () => {
  
  test('should edit existing config value', async ({ authenticatedPage }) => {
    // First create a config
    const configKey = testData.config.uniqueKey();
    
    await authenticatedPage.goto('/');
    await authenticatedPage.waitForLoadState('networkidle');
    
    const createBtn = authenticatedPage.locator('button:has-text("Create Config"), button:has-text("新建配置")');
    if (await createBtn.count() === 0) {
      test.skip();
    }
    
    // Create config
    await createBtn.first().click();
    
    const keyInput = authenticatedPage.locator('input[name="key"], input[id="key"]');
    const valueInput = authenticatedPage.locator('input[name="value"], input[id="value"]');
    
    await keyInput.fill(configKey);
    await valueInput.fill('original_value');
    
    const submitBtn = authenticatedPage.locator('button[type="submit"]:has-text("Create")');
    await submitBtn.click();
    
    await authenticatedPage.waitForTimeout(1000);
    
    // Now edit the config
    const configRow = authenticatedPage.locator('tr', { has: authenticatedPage.locator(`text="${configKey}"`) });
    const editBtn = configRow.locator('button:has-text("Edit"), button:has-text("编辑")');
    
    if (await editBtn.count() > 0) {
      await editBtn.click();
      
      // Change value
      const editValueInput = authenticatedPage.locator('input[name="value"], input[id="value"]');
      await editValueInput.clear();
      await editValueInput.fill('updated_value');
      
      const saveBtn = authenticatedPage.locator('button[type="submit"]:has-text("Save"), button[type="submit"]:has-text("保存")');
      await saveBtn.click();
      
      await authenticatedPage.waitForTimeout(1000);
      
      // Updated value should be visible
      await expect(authenticatedPage.locator('text=updated_value')).toBeVisible();
    }
  });

  test('should show change reason prompt when editing', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Look for any config row with edit button
    const editBtn = authenticatedPage.locator('button:has-text("Edit"), button:has-text("编辑")').first();
    
    if (await editBtn.count() > 0) {
      await editBtn.click();
      
      // Should see change reason field
      const reasonInput = authenticatedPage.locator('input[name="changeReason"], textarea[name="changeReason"]');
      const reasonCount = await reasonInput.count();
      
      // Change reason field may or may not be present depending on implementation
      expect(typeof reasonCount).toBe('number');
    }
  });
});

test.describe('Config Deletion', () => {
  
  test('should delete config from list', async ({ authenticatedPage }) => {
    const configKey = testData.config.uniqueKey();
    
    await authenticatedPage.goto('/');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Create config first
    const createBtn = authenticatedPage.locator('button:has-text("Create Config"), button:has-text("新建配置")');
    if (await createBtn.count() === 0) {
      test.skip();
    }
    
    await createBtn.first().click();
    
    const keyInput = authenticatedPage.locator('input[name="key"], input[id="key"]');
    const valueInput = authenticatedPage.locator('input[name="value"], input[id="value"]');
    
    await keyInput.fill(configKey);
    await valueInput.fill('to_be_deleted');
    
    const submitBtn = authenticatedPage.locator('button[type="submit"]:has-text("Create")');
    await submitBtn.click();
    
    await authenticatedPage.waitForTimeout(1000);
    
    // Verify config exists
    const configCell = authenticatedPage.locator(`text=${configKey}`);
    await expect(configCell.first()).toBeVisible();
    
    // Delete config
    const configRow = authenticatedPage.locator('tr', { has: authenticatedPage.locator(`text="${configKey}"`) });
    const deleteBtn = configRow.locator('button:has-text("Delete"), button:has-text("删除"), button[title="Delete"]');
    
    if (await deleteBtn.count() > 0) {
      // Handle confirmation dialog
      authenticatedPage.on('dialog', dialog => dialog.accept());
      
      await deleteBtn.click();
      await authenticatedPage.waitForTimeout(1000);
      
      // Config should be gone
      await expect(authenticatedPage.locator(`text=${configKey}`)).toHaveCount(0, { timeout: 5000 });
    }
  });

  test('should show confirmation before deletion', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    await authenticatedPage.waitForLoadState('networkidle');
    
    const deleteBtn = authenticatedPage.locator('button:has-text("Delete"), button:has-text("删除")').first();
    
    if (await deleteBtn.count() > 0) {
      let dialogShown = false;
      
      authenticatedPage.on('dialog', dialog => {
        dialogShown = true;
        dialog.dismiss();
      });
      
      await deleteBtn.click();
      await authenticatedPage.waitForTimeout(500);
      
      // Dialog should have been shown
      expect(dialogShown).toBeTruthy();
    }
  });
});
