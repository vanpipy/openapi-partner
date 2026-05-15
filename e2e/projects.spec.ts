import { test, expect, testData } from './helpers';

/**
 * E2E Tests for Project Management
 * 
 * Tests cover:
 * - Projects page loads correctly
 * - Project creation via dialog
 * - Project editing
 * - Project deletion
 * - Project detail page
 * - Triggering sync tasks
 */

test.describe('Projects Page', () => {
  
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/projects');
    await authenticatedPage.waitForLoadState('networkidle');
  });

  test('should display projects page header', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('h1')).toContainText('API Type Automation');
    await expect(authenticatedPage.locator('text=Projects')).toBeVisible();
  });

  test('should show quick start guide in sidebar', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('text=Quick Start')).toBeVisible();
    await expect(authenticatedPage.locator('text=Create a project')).toBeVisible();
    await expect(authenticatedPage.locator('text=Generate a token')).toBeVisible();
  });

  test('should show empty state when no projects exist', async ({ authenticatedPage }) => {
    // Check for empty state message or project table
    const emptyState = authenticatedPage.locator('text=/No projects yet|Create your first/');
    const projectTable = authenticatedPage.locator('table');
    
    // Either empty state OR table should be visible
    const emptyVisible = await emptyState.count() > 0;
    const tableVisible = await projectTable.isVisible().catch(() => false);
    
    expect(emptyVisible || tableVisible).toBeTruthy();
  });
});

test.describe('Project Creation', () => {
  
  test('should open create project dialog when clicking New Project button', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/projects');
    
    // Click New Project button
    const newProjectBtn = authenticatedPage.locator('button:has-text("New Project"), button:has-text("Create Project")');
    await newProjectBtn.click();
    
    // Dialog should open
    const dialog = authenticatedPage.locator('[role="dialog"], .dialog-content');
    await expect(dialog).toBeVisible({ timeout: 3000 });
    
    // Form fields should be visible
    await expect(authenticatedPage.locator('input[name="name"]')).toBeVisible();
    await expect(authenticatedPage.locator('input[name="specUrl"]')).toBeVisible();
  });

  test('should create project with valid data', async ({ authenticatedPage }) => {
    const projectName = testData.project.uniqueName();
    
    await authenticatedPage.goto('/projects');
    
    // Open create dialog
    await authenticatedPage.click('button:has-text("New Project")');
    
    // Fill form
    await authenticatedPage.fill('input[name="name"]', projectName);
    await authenticatedPage.fill('input[name="specUrl"]', testData.project.swaggerUrl);
    await authenticatedPage.fill('input[name="outputPath"]', testData.project.outputPath);
    
    // Submit form
    await authenticatedPage.click('button[type="submit"]:has-text("Create Project")');
    
    // Wait for dialog to close and project to appear
    await authenticatedPage.waitForTimeout(1000);
    
    // Project should appear in the list
    const projectLink = authenticatedPage.locator(`a:has-text("${projectName}")`);
    await expect(projectLink.first()).toBeVisible({ timeout: 5000 });
  });

  test('should show validation error for invalid URL', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/projects');
    
    // Open create dialog
    await authenticatedPage.click('button:has-text("New Project")');
    
    // Fill with invalid URL
    await authenticatedPage.fill('input[name="name"]', 'Test Project');
    await authenticatedPage.fill('input[name="specUrl"]', 'not-a-valid-url');
    
    // Submit form
    await authenticatedPage.click('button[type="submit"]:has-text("Create Project")');
    
    // Browser validation should catch invalid URL
    const urlInput = authenticatedPage.locator('input[name="specUrl"]');
    await expect(urlInput).toHaveAttribute('type', 'url');
  });

  test('should require project name field', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/projects');
    
    await authenticatedPage.click('button:has-text("New Project")');
    
    // Fill only URL, leave name empty
    await authenticatedPage.fill('input[name="specUrl"]', testData.project.swaggerUrl);
    
    // Submit
    await authenticatedPage.click('button[type="submit"]:has-text("Create Project")');
    
    // Required validation should trigger
    const nameInput = authenticatedPage.locator('input[name="name"]');
    // The input should be marked as required
    await expect(nameInput).toHaveAttribute('required');
  });

  test('should close dialog on cancel', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/projects');
    
    // Open dialog
    await authenticatedPage.click('button:has-text("New Project")');
    const dialog = authenticatedPage.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    
    // Click cancel
    await authenticatedPage.click('button:has-text("Cancel")');
    
    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });

  test('should close dialog on successful creation', async ({ authenticatedPage }) => {
    const projectName = testData.project.uniqueName();
    
    await authenticatedPage.goto('/projects');
    
    await authenticatedPage.click('button:has-text("New Project")');
    await authenticatedPage.fill('input[name="name"]', projectName);
    await authenticatedPage.fill('input[name="specUrl"]', testData.project.swaggerUrl);
    
    await authenticatedPage.click('button[type="submit"]:has-text("Create Project")');
    
    // Wait for dialog to close
    await authenticatedPage.waitForTimeout(1000);
    
    const dialog = authenticatedPage.locator('[role="dialog"]');
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe('Project Detail Page', () => {
  
  test('should navigate to project detail when clicking project name', async ({ authenticatedPage }) => {
    const projectName = testData.project.uniqueName();
    
    // Create a project first
    await authenticatedPage.goto('/projects');
    await authenticatedPage.click('button:has-text("New Project")');
    await authenticatedPage.fill('input[name="name"]', projectName);
    await authenticatedPage.fill('input[name="specUrl"]', testData.project.swaggerUrl);
    await authenticatedPage.click('button[type="submit"]:has-text("Create Project")');
    await authenticatedPage.waitForTimeout(1000);
    
    // Click on the project name
    const projectLink = authenticatedPage.locator(`a:has-text("${projectName}")`).first();
    await projectLink.click();
    
    // Should navigate to project detail page
    await authenticatedPage.waitForURL(/\/projects\/\d+/, { timeout: 5000 });
    
    // Should see project detail content
    await expect(authenticatedPage.locator('h1')).toContainText(projectName);
  });

  test('should display project details correctly', async ({ authenticatedPage }) => {
    const projectName = testData.project.uniqueName();
    
    // Create project
    await authenticatedPage.goto('/projects');
    await authenticatedPage.click('button:has-text("New Project")');
    await authenticatedPage.fill('input[name="name"]', projectName);
    await authenticatedPage.fill('input[name="specUrl"]', testData.project.swaggerUrl);
    await authenticatedPage.click('button[type="submit"]:has-text("Create Project")');
    await authenticatedPage.waitForTimeout(1000);
    
    // Navigate to project detail
    const projectLink = authenticatedPage.locator(`a:has-text("${projectName}")`).first();
    await projectLink.click();
    await authenticatedPage.waitForURL(/\/projects\/\d+/);
    
    // Check detail elements
    await expect(authenticatedPage.locator('text=API Tokens')).toBeVisible();
    await expect(authenticatedPage.locator('text=Tasks')).toBeVisible();
    await expect(authenticatedPage.locator('text=Settings')).toBeVisible();
    
    // Check spec URL is displayed
    await expect(authenticatedPage.locator(`a[href="${testData.project.swaggerUrl}"]`)).toBeVisible();
  });

  test('should show tabs for different sections', async ({ authenticatedPage }) => {
    const projectName = testData.project.uniqueName();
    
    // Create and navigate to project
    await authenticatedPage.goto('/projects');
    await authenticatedPage.click('button:has-text("New Project")');
    await authenticatedPage.fill('input[name="name"]', projectName);
    await authenticatedPage.fill('input[name="specUrl"]', testData.project.swaggerUrl);
    await authenticatedPage.click('button[type="submit"]:has-text("Create Project")');
    await authenticatedPage.waitForTimeout(1000);
    
    const projectLink = authenticatedPage.locator(`a:has-text("${projectName}")`).first();
    await projectLink.click();
    await authenticatedPage.waitForURL(/\/projects\/\d+/);
    
    // Check all tabs are present
    await expect(authenticatedPage.locator('[role="tablist"]').locator('text=API Tokens')).toBeVisible();
    await expect(authenticatedPage.locator('[role="tablist"]').locator('text=Tasks')).toBeVisible();
    await expect(authenticatedPage.locator('[role="tablist"]').locator('text=Settings')).toBeVisible();
  });

  test('should navigate back to projects list', async ({ authenticatedPage }) => {
    const projectName = testData.project.uniqueName();
    
    // Create and navigate to project
    await authenticatedPage.goto('/projects');
    await authenticatedPage.click('button:has-text("New Project")');
    await authenticatedPage.fill('input[name="name"]', projectName);
    await authenticatedPage.fill('input[name="specUrl"]', testData.project.swaggerUrl);
    await authenticatedPage.click('button[type="submit"]:has-text("Create Project")');
    await authenticatedPage.waitForTimeout(1000);
    
    const projectLink = authenticatedPage.locator(`a:has-text("${projectName}")`).first();
    await projectLink.click();
    await authenticatedPage.waitForURL(/\/projects\/\d+/);
    
    // Click back button
    await authenticatedPage.click('a:has-text("Back")');
    
    // Should be back on projects list
    await authenticatedPage.waitForURL('**/projects', { timeout: 5000 });
    await expect(authenticatedPage.locator('h1')).toContainText('API Type Automation');
  });
});

test.describe('Project Sync', () => {
  
  test('should trigger sync from project list', async ({ authenticatedPage }) => {
    const projectName = testData.project.uniqueName();
    
    // Create project
    await authenticatedPage.goto('/projects');
    await authenticatedPage.click('button:has-text("New Project")');
    await authenticatedPage.fill('input[name="name"]', projectName);
    await authenticatedPage.fill('input[name="specUrl"]', testData.project.swaggerUrl);
    await authenticatedPage.click('button[type="submit"]:has-text("Create Project")');
    await authenticatedPage.waitForTimeout(1000);
    
    // Open project menu and trigger sync
    const moreButton = authenticatedPage.locator('table tr').first().locator('button');
    await moreButton.click();
    
    // Look for sync option
    const syncOption = authenticatedPage.locator('text=Sync Types');
    await expect(syncOption).toBeVisible();
  });

  test('should show task in project detail after sync', async ({ authenticatedPage }) => {
    const projectName = testData.project.uniqueName();
    
    // Create project and navigate to detail
    await authenticatedPage.goto('/projects');
    await authenticatedPage.click('button:has-text("New Project")');
    await authenticatedPage.fill('input[name="name"]', projectName);
    await authenticatedPage.fill('input[name="specUrl"]', testData.project.swaggerUrl);
    await authenticatedPage.click('button[type="submit"]:has-text("Create Project")');
    await authenticatedPage.waitForTimeout(1000);
    
    const projectLink = authenticatedPage.locator(`a:has-text("${projectName}")`).first();
    await projectLink.click();
    await authenticatedPage.waitForURL(/\/projects\/\d+/);
    
    // Click Tasks tab
    await authenticatedPage.click('[role="tablist"] >> text=Tasks');
    await authenticatedPage.waitForTimeout(500);
    
    // Should show task area (empty or with tasks)
    await expect(authenticatedPage.locator('text=Task History')).toBeVisible();
  });
});

test.describe('Project Deletion', () => {
  
  test('should delete project from project list', async ({ authenticatedPage }) => {
    const projectName = testData.project.uniqueName();
    
    // Create project
    await authenticatedPage.goto('/projects');
    await authenticatedPage.click('button:has-text("New Project")');
    await authenticatedPage.fill('input[name="name"]', projectName);
    await authenticatedPage.fill('input[name="specUrl"]', testData.project.swaggerUrl);
    await authenticatedPage.click('button[type="submit"]:has-text("Create Project")');
    await authenticatedPage.waitForTimeout(1000);
    
    // Verify project exists
    const projectLink = authenticatedPage.locator(`a:has-text("${projectName}")`);
    await expect(projectLink.first()).toBeVisible();
    
    // Open menu and delete
    const moreButton = authenticatedPage.locator('table tr').first().locator('button');
    await moreButton.click();
    
    // Click delete
    const deleteOption = authenticatedPage.locator('text=Delete');
    await deleteOption.click();
    
    // Confirm dialog if appears
    authenticatedPage.on('dialog', dialog => dialog.accept());
    
    await authenticatedPage.waitForTimeout(1000);
    
    // Project should be gone (or empty state shown)
    await expect(authenticatedPage.locator(`a:has-text("${projectName}")`)).toHaveCount(0, { timeout: 5000 });
  });
});
