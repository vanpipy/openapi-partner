import { test as base, Page, BrowserContext } from '@playwright/test';

/**
 * Extended test fixtures for e2e testing
 */
export interface TestFixtures {
  authenticatedPage: Page;
  cleanupProject: (projectId: number) => Promise<void>;
  cleanupAllTestData: () => Promise<void>;
}

/**
 * Custom test runner with fixtures
 */
export const test = base.extend<TestFixtures>({
  // Authenticated page - navigates to app and logs in
  authenticatedPage: async ({ page, baseURL }, use) => {
    await page.goto(baseURL!);
    
    // Check if we're already logged in (on projects page)
    const currentUrl = page.url();
    if (!currentUrl.includes('/login')) {
      await use(page);
      return;
    }
    
    // Perform login with default credentials
    await page.fill('input[id="username"]', 'admin');
    await page.fill('input[id="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to projects page
    await page.waitForURL('**/projects', { timeout: 10000 });
    
    await use(page);
  },
  
  // Cleanup helper for test projects
  cleanupProject: async ({ request }, use) => {
    const createdProjects: number[] = [];
    
    await use(async (projectId: number) => {
      createdProjects.push(projectId);
    });
    
    // Cleanup after test
    for (const projectId of createdProjects) {
      try {
        await request.delete(`${process.env.BASE_URL || 'http://localhost:3000'}/api/projects/${projectId}`);
      } catch {
        // Ignore cleanup errors
      }
    }
  },
  
  // Cleanup all test data
  cleanupAllTestData: async ({ request }, use) => {
    await use(async () => {
      // This would typically hit an admin API or use direct DB access
      // For now, we rely on test isolation via unique names
    });
  },
});

export { expect } from '@playwright/test';

/**
 * Test data generators
 */
export const testData = {
  project: {
    uniqueName: () => `Test Project ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    swaggerUrl: 'https://petstore.swagger.io/v2/swagger.json',
    outputPath: './generated/test-api',
    apiVersion: '1.0.0',
    baseUrl: 'https://petstore.swagger.io/v2',
  },
  token: {
    uniqueName: () => `Test Token ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    permissions: {
      readOnly: ['read'],
      readWrite: ['read', 'write'],
      admin: ['read', 'write', 'admin'],
    },
  },
  config: {
    uniqueKey: () => `test_config_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  },
};
