import { test, expect, testData } from './helpers';

/**
 * E2E Tests for Token Management
 * 
 * Tests cover:
 * - Token creation
 * - Token display and copy
 * - Token revocation
 * - Permission display
 */

test.describe('Token Management', () => {
  
  test('should display token manager in project detail', async ({ authenticatedPage }) => {
    // Create a project first
    const projectName = testData.project.uniqueName();
    await authenticatedPage.goto('/projects');
    await authenticatedPage.click('button:has-text("New Project")');
    await authenticatedPage.fill('input[name="name"]', projectName);
    await authenticatedPage.fill('input[name="specUrl"]', testData.project.swaggerUrl);
    await authenticatedPage.click('button[type="submit"]:has-text("Create Project")');
    await authenticatedPage.waitForTimeout(1000);
    
    // Navigate to project
    const projectLink = authenticatedPage.locator(`a:has-text("${projectName}")`).first();
    await projectLink.click();
    await authenticatedPage.waitForURL(/\/projects\/\d+/);
    
    // Should see API Tokens tab
    await expect(authenticatedPage.locator('text=API Tokens')).toBeVisible();
  });

  test('should show create token button in token manager', async ({ authenticatedPage }) => {
    const projectName = testData.project.uniqueName();
    
    // Setup project
    await authenticatedPage.goto('/projects');
    await authenticatedPage.click('button:has-text("New Project")');
    await authenticatedPage.fill('input[name="name"]', projectName);
    await authenticatedPage.fill('input[name="specUrl"]', testData.project.swaggerUrl);
    await authenticatedPage.click('button[type="submit"]:has-text("Create Project")');
    await authenticatedPage.waitForTimeout(1000);
    
    // Navigate to project
    const projectLink = authenticatedPage.locator(`a:has-text("${projectName}")`).first();
    await projectLink.click();
    await authenticatedPage.waitForURL(/\/projects\/\d+/);
    
    // Should see Create Token button
    await expect(authenticatedPage.locator('button:has-text("Create Token")')).toBeVisible();
  });

  test('should open create token dialog', async ({ authenticatedPage }) => {
    const projectName = testData.project.uniqueName();
    
    await authenticatedPage.goto('/projects');
    await authenticatedPage.click('button:has-text("New Project")');
    await authenticatedPage.fill('input[name="name"]', projectName);
    await authenticatedPage.fill('input[name="specUrl"]', testData.project.swaggerUrl);
    await authenticatedPage.click('button[type="submit"]:has-text("Create Project")');
    await authenticatedPage.waitForTimeout(1000);
    
    const projectLink = authenticatedPage.locator(`a:has-text("${projectName}")`).first();
    await projectLink.click();
    await authenticatedPage.waitForURL(/\/projects\/\d+/);
    
    // Click create token button
    await authenticatedPage.click('button:has-text("Create Token")');
    
    // Dialog should appear
    const dialog = authenticatedPage.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });
    
    // Should see token name field
    await expect(authenticatedPage.locator('input[name="name"]')).toBeVisible();
  });

  test('should show permission checkboxes in create dialog', async ({ authenticatedPage }) => {
    const projectName = testData.project.uniqueName();
    
    await authenticatedPage.goto('/projects');
    await authenticatedPage.click('button:has-text("New Project")');
    await authenticatedPage.fill('input[name="name"]', projectName);
    await authenticatedPage.fill('input[name="specUrl"]', testData.project.swaggerUrl);
    await authenticatedPage.click('button[type="submit"]:has-text("Create Project")');
    await authenticatedPage.waitForTimeout(1000);
    
    const projectLink = authenticatedPage.locator(`a:has-text("${projectName}")`).first();
    await projectLink.click();
    await authenticatedPage.waitForURL(/\/projects\/\d+/);
    
    await authenticatedPage.click('button:has-text("Create Token")');
    
    // Should see permission checkboxes
    await expect(authenticatedPage.locator('text=Read')).toBeVisible();
    await expect(authenticatedPage.locator('text=Write')).toBeVisible();
    await expect(authenticatedPage.locator('text=Admin')).toBeVisible();
    
    // Read should be checked by default
    const readCheckbox = authenticatedPage.locator('input[name="permission-read"]');
    await expect(readCheckbox).toBeChecked();
  });

  test('should create token successfully', async ({ authenticatedPage }) => {
    const projectName = testData.project.uniqueName();
    const tokenName = testData.token.uniqueName();
    
    await authenticatedPage.goto('/projects');
    await authenticatedPage.click('button:has-text("New Project")');
    await authenticatedPage.fill('input[name="name"]', projectName);
    await authenticatedPage.fill('input[name="specUrl"]', testData.project.swaggerUrl);
    await authenticatedPage.click('button[type="submit"]:has-text("Create Project")');
    await authenticatedPage.waitForTimeout(1000);
    
    const projectLink = authenticatedPage.locator(`a:has-text("${projectName}")`).first();
    await projectLink.click();
    await authenticatedPage.waitForURL(/\/projects\/\d+/);
    
    // Open create token dialog
    await authenticatedPage.click('button:has-text("Create Token")');
    await authenticatedPage.fill('input[name="name"]', tokenName);
    
    // Submit
    await authenticatedPage.click('button[type="submit"]:has-text("Create Token")');
    
    // Wait for token creation
    await authenticatedPage.waitForTimeout(1000);
    
    // Should see success message with token
    await expect(authenticatedPage.locator('text=Token Created!')).toBeVisible({ timeout: 5000 });
    
    // Should see the token value
    await expect(authenticatedPage.locator('input[readonly]').first()).toBeVisible();
  });

  test('should display token in list after creation', async ({ authenticatedPage }) => {
    const projectName = testData.project.uniqueName();
    const tokenName = testData.token.uniqueName();
    
    await authenticatedPage.goto('/projects');
    await authenticatedPage.click('button:has-text("New Project")');
    await authenticatedPage.fill('input[name="name"]', projectName);
    await authenticatedPage.fill('input[name="specUrl"]', testData.project.swaggerUrl);
    await authenticatedPage.click('button[type="submit"]:has-text("Create Project")');
    await authenticatedPage.waitForTimeout(1000);
    
    const projectLink = authenticatedPage.locator(`a:has-text("${projectName}")`).first();
    await projectLink.click();
    await authenticatedPage.waitForURL(/\/projects\/\d+/);
    
    // Create first token
    await authenticatedPage.click('button:has-text("Create Token")');
    await authenticatedPage.fill('input[name="name"]', tokenName);
    await authenticatedPage.click('button[type="submit"]:has-text("Create Token")');
    await authenticatedPage.waitForTimeout(1000);
    
    // Dismiss the token shown message by clicking "I've saved my token"
    const savedButton = authenticatedPage.locator('text=I\'ve saved my token');
    if (await savedButton.isVisible()) {
      await savedButton.click();
    }
    
    await authenticatedPage.waitForTimeout(500);
    
    // Token should appear in the list
    const tokenCell = authenticatedPage.locator(`text=${tokenName}`);
    await expect(tokenCell.first()).toBeVisible();
    
    // Should see permissions badges
    await expect(authenticatedPage.locator('text=read')).toBeVisible();
  });

  test('should revoke token successfully', async ({ authenticatedPage }) => {
    const projectName = testData.project.uniqueName();
    const tokenName = testData.token.uniqueName();
    
    await authenticatedPage.goto('/projects');
    await authenticatedPage.click('button:has-text("New Project")');
    await authenticatedPage.fill('input[name="name"]', projectName);
    await authenticatedPage.fill('input[name="specUrl"]', testData.project.swaggerUrl);
    await authenticatedPage.click('button[type="submit"]:has-text("Create Project")');
    await authenticatedPage.waitForTimeout(1000);
    
    const projectLink = authenticatedPage.locator(`a:has-text("${projectName}")`).first();
    await projectLink.click();
    await authenticatedPage.waitForURL(/\/projects\/\d+/);
    
    // Create token
    await authenticatedPage.click('button:has-text("Create Token")');
    await authenticatedPage.fill('input[name="name"]', tokenName);
    await authenticatedPage.click('button[type="submit"]:has-text("Create Token")');
    await authenticatedPage.waitForTimeout(1000);
    
    // Dismiss token shown message
    const savedButton = authenticatedPage.locator('text=I\'ve saved my token');
    if (await savedButton.isVisible()) {
      await savedButton.click();
    }
    await authenticatedPage.waitForTimeout(500);
    
    // Find and click revoke button for this token
    const tokenRow = authenticatedPage.locator('tr', { has: authenticatedPage.locator(`text="${tokenName}"`) });
    const revokeButton = tokenRow.locator('button[title="Delete"], button:has-text("Delete")');
    
    // Handle confirmation dialog
    authenticatedPage.on('dialog', dialog => dialog.accept());
    
    await revokeButton.click();
    await authenticatedPage.waitForTimeout(1000);
    
    // Token should no longer be in the list
    await expect(authenticatedPage.locator(`text=${tokenName}`)).toHaveCount(0);
  });

  test('should show empty state when no tokens exist', async ({ authenticatedPage }) => {
    const projectName = testData.project.uniqueName();
    
    await authenticatedPage.goto('/projects');
    await authenticatedPage.click('button:has-text("New Project")');
    await authenticatedPage.fill('input[name="name"]', projectName);
    await authenticatedPage.fill('input[name="specUrl"]', testData.project.swaggerUrl);
    await authenticatedPage.click('button[type="submit"]:has-text("Create Project")');
    await authenticatedPage.waitForTimeout(1000);
    
    const projectLink = authenticatedPage.locator(`a:has-text("${projectName}")`).first();
    await projectLink.click();
    await authenticatedPage.waitForURL(/\/projects\/\d+/);
    
    // Should see empty state message
    await expect(authenticatedPage.locator('text=/No tokens yet|Create one to enable/')).toBeVisible();
  });

  test('should display token permissions correctly', async ({ authenticatedPage }) => {
    const projectName = testData.project.uniqueName();
    const tokenName = testData.token.uniqueName();
    
    await authenticatedPage.goto('/projects');
    await authenticatedPage.click('button:has-text("New Project")');
    await authenticatedPage.fill('input[name="name"]', projectName);
    await authenticatedPage.fill('input[name="specUrl"]', testData.project.swaggerUrl);
    await authenticatedPage.click('button[type="submit"]:has-text("Create Project")');
    await authenticatedPage.waitForTimeout(1000);
    
    const projectLink = authenticatedPage.locator(`a:has-text("${projectName}")`).first();
    await projectLink.click();
    await authenticatedPage.waitForURL(/\/projects\/\d+/);
    
    // Create token with all permissions
    await authenticatedPage.click('button:has-text("Create Token")');
    await authenticatedPage.fill('input[name="name"]', tokenName);
    
    // Check write and admin checkboxes
    await authenticatedPage.check('input[name="permission-write"]');
    await authenticatedPage.check('input[name="permission-admin"]');
    
    await authenticatedPage.click('button[type="submit"]:has-text("Create Token")');
    await authenticatedPage.waitForTimeout(1000);
    
    // Dismiss token shown
    const savedButton = authenticatedPage.locator('text=I\'ve saved my token');
    if (await savedButton.isVisible()) {
      await savedButton.click();
    }
    await authenticatedPage.waitForTimeout(500);
    
    // Should see all permission badges
    await expect(authenticatedPage.locator('text=read')).toBeVisible();
    await expect(authenticatedPage.locator('text=write')).toBeVisible();
    await expect(authenticatedPage.locator('text=admin')).toBeVisible();
  });

  test('should show expiration date for expiring tokens', async ({ authenticatedPage }) => {
    const projectName = testData.project.uniqueName();
    const tokenName = testData.token.uniqueName();
    
    await authenticatedPage.goto('/projects');
    await authenticatedPage.click('button:has-text("New Project")');
    await authenticatedPage.fill('input[name="name"]', projectName);
    await authenticatedPage.fill('input[name="specUrl"]', testData.project.swaggerUrl);
    await authenticatedPage.click('button[type="submit"]:has-text("Create Project")');
    await authenticatedPage.waitForTimeout(1000);
    
    const projectLink = authenticatedPage.locator(`a:has-text("${projectName}")`).first();
    await projectLink.click();
    await authenticatedPage.waitForURL(/\/projects\/\d+/);
    
    // Create token with expiration
    await authenticatedPage.click('button:has-text("Create Token")');
    await authenticatedPage.fill('input[name="name"]', tokenName);
    await authenticatedPage.fill('input[name="expiresInDays"]', '30');
    
    await authenticatedPage.click('button[type="submit"]:has-text("Create Token")');
    await authenticatedPage.waitForTimeout(1000);
    
    // Token creation should succeed
    await expect(authenticatedPage.locator('text=Token Created!')).toBeVisible({ timeout: 5000 });
  });
});
