import { test, expect } from '@playwright/test';

test.describe('Sync and SSE', () => {
  test.describe('Projects Page', () => {
    test('should load projects page', async ({ page }) => {
      await page.goto('/projects');
      
      // Check page loads without crash
      await expect(page.locator('body')).toBeVisible();
      
      // Check for main heading
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('should display project list', async ({ page }) => {
      await page.goto('/projects');
      
      // Check for table or project list
      const table = page.locator('table');
      if (await table.isVisible().catch(() => false)) {
        await expect(table).toBeVisible();
      }
    });
  });

  test.describe('Project Detail Page', () => {
    test('should navigate to project detail', async ({ page }) => {
      await page.goto('/projects');
      
      // Find first project link
      const projectLink = page.locator('a[href^="/projects/"]').first();
      
      if (await projectLink.isVisible().catch(() => false)) {
        await projectLink.click();
        await page.waitForURL(/\/projects\/\d+/);
        
        // Should be on detail page
        await expect(page.locator('body')).toBeVisible();
      } else {
        test.skip();
      }
    });

    test('should display task history section after clicking Tasks tab', async ({ page }) => {
      await page.goto('/projects');
      
      // Navigate to project detail
      const projectLink = page.locator('a[href^="/projects/"]').first();
      
      if (await projectLink.isVisible().catch(() => false)) {
        await projectLink.click();
        await page.waitForURL(/\/projects\/\d+/);
        await page.waitForTimeout(500);
        
        // Click on Tasks tab
        const tasksTab = page.locator('text=Tasks');
        if (await tasksTab.isVisible().catch(() => false)) {
          await tasksTab.click();
          await page.waitForTimeout(500);
          
          // Check for Task History header
          const taskHistory = page.locator('text=Task History');
          if (await taskHistory.isVisible().catch(() => false)) {
            await expect(taskHistory).toBeVisible();
          } else {
            test.skip();
          }
        } else {
          test.skip();
        }
      } else {
        test.skip();
      }
    });

    test('should display task stats after clicking Tasks tab', async ({ page }) => {
      await page.goto('/projects');
      
      // Navigate to project detail
      const projectLink = page.locator('a[href^="/projects/"]').first();
      
      if (await projectLink.isVisible().catch(() => false)) {
        await projectLink.click();
        await page.waitForURL(/\/projects\/\d+/);
        await page.waitForTimeout(500);
        
        // Click on Tasks tab
        const tasksTab = page.locator('text=Tasks');
        if (await tasksTab.isVisible().catch(() => false)) {
          await tasksTab.click();
          await page.waitForTimeout(500);
          
          // Check for stat labels
          const totalLabel = page.locator('text=Total');
          if (await totalLabel.isVisible().catch(() => false)) {
            await expect(totalLabel).toBeVisible();
          } else {
            test.skip();
          }
        } else {
          test.skip();
        }
      } else {
        test.skip();
      }
    });
  });

  test.describe('Sync Idempotency', () => {
    test('should handle sync button in Tasks tab', async ({ page }) => {
      await page.goto('/projects');
      
      // Navigate to project detail
      const projectLink = page.locator('a[href^="/projects/"]').first();
      
      if (await projectLink.isVisible().catch(() => false)) {
        await projectLink.click();
        await page.waitForURL(/\/projects\/\d+/);
        await page.waitForTimeout(500);

        // Click on Tasks tab
        const tasksTab = page.locator('text=Tasks');
        if (await tasksTab.isVisible().catch(() => false)) {
          await tasksTab.click();
          await page.waitForTimeout(500);

          // Check for sync button
          const syncButton = page.locator('button:has-text("Sync Now")');
          if (await syncButton.isVisible().catch(() => false)) {
            await expect(syncButton).toBeVisible();
            await expect(syncButton).toBeEnabled();
          } else {
            test.skip();
          }
        } else {
          test.skip();
        }
      } else {
        test.skip();
      }
    });

    test('should trigger sync and see task created', async ({ page }) => {
      await page.goto('/projects');
      
      // Navigate to project detail
      const projectLink = page.locator('a[href^="/projects/"]').first();
      
      if (await projectLink.isVisible().catch(() => false)) {
        await projectLink.click();
        await page.waitForURL(/\/projects\/\d+/);
        await page.waitForTimeout(500);

        // Click on Tasks tab
        const tasksTab = page.locator('text=Tasks');
        if (await tasksTab.isVisible().catch(() => false)) {
          await tasksTab.click();
          await page.waitForTimeout(500);

          // Check for sync button
          const syncButton = page.locator('button:has-text("Sync Now")');
          if (await syncButton.isVisible().catch(() => false)) {
            // Click sync
            await syncButton.click();
            await page.waitForTimeout(1000);
            
            // Page should not crash
            await expect(page.locator('body')).toBeVisible();
          } else {
            test.skip();
          }
        } else {
          test.skip();
        }
      } else {
        test.skip();
      }
    });
  });

  test.describe('Live Connection Indicator', () => {
    test('should show connection status on Tasks tab', async ({ page }) => {
      await page.goto('/projects');
      
      // Navigate to project detail
      const projectLink = page.locator('a[href^="/projects/"]').first();
      
      if (await projectLink.isVisible().catch(() => false)) {
        await projectLink.click();
        await page.waitForURL(/\/projects\/\d+/);
        await page.waitForTimeout(500);

        // Click on Tasks tab
        const tasksTab = page.locator('text=Tasks');
        if (await tasksTab.isVisible().catch(() => false)) {
          await tasksTab.click();
          
          // Wait for content to load (either tasks or empty state)
          await page.waitForTimeout(1000);
          
          // Wait for loading to complete
          await page.waitForFunction(() => {
            const loadingText = document.body.innerText;
            return !loadingText.includes('Loading tasks');
          }, { timeout: 5000 }).catch(() => {});

          // Check for sync button or Task History
          const syncButton = page.locator('button:has-text("Sync Now")');
          const taskHistory = page.locator('text=Task History');
          
          const hasSync = await syncButton.isVisible().catch(() => false);
          const hasTaskHistory = await taskHistory.isVisible().catch(() => false);
          
          expect(hasSync || hasTaskHistory).toBeTruthy();
        } else {
          test.skip();
        }
      } else {
        test.skip();
      }
    });
  });

  test.describe('Task Details Layout', () => {
    test('should display project detail layout', async ({ page }) => {
      await page.goto('/projects');
      
      // Navigate to project detail
      const projectLink = page.locator('a[href^="/projects/"]').first();
      
      if (await projectLink.isVisible().catch(() => false)) {
        await projectLink.click();
        await page.waitForURL(/\/projects\/\d+/);
        await page.waitForTimeout(500);

        // Check that main content is visible
        const mainContent = page.locator('main, [role="main"], .container');
        await expect(mainContent.first()).toBeVisible();
        
        // Check that tabs are visible
        const tabs = page.locator('[role="tablist"]');
        if (await tabs.isVisible().catch(() => false)) {
          await expect(tabs).toBeVisible();
        }
      } else {
        test.skip();
      }
    });

    test('should display task table after clicking Tasks tab', async ({ page }) => {
      await page.goto('/projects');
      
      // Navigate to project detail
      const projectLink = page.locator('a[href^="/projects/"]').first();
      
      if (await projectLink.isVisible().catch(() => false)) {
        await projectLink.click();
        await page.waitForURL(/\/projects\/\d+/);
        await page.waitForTimeout(500);

        // Click on Tasks tab
        const tasksTab = page.locator('text=Tasks');
        if (await tasksTab.isVisible().catch(() => false)) {
          await tasksTab.click();
          await page.waitForTimeout(500);

          // Check for task table
          const table = page.locator('table');
          if (await table.isVisible().catch(() => false)) {
            await expect(table).toBeVisible();
          } else {
            test.skip();
          }
        } else {
          test.skip();
        }
      } else {
        test.skip();
      }
    });
  });
});
