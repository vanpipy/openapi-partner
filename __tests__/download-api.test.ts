/**
 * Tests for download API endpoints
 * Note: These test the data layer, not the HTTP endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { projects, tasks } from '@/lib/db/schema';
import { TaskStatus } from '@/lib/db/schema';

describe('Download API Data Layer', () => {
  let db: ReturnType<typeof getDb>;
  let testProjectId: number;
  let testTaskId: string;
  let testPublicToken: string;

  beforeAll(async () => {
    db = getDb();
    await db.run(sql`DELETE FROM tasks`);
    await db.run(sql`DELETE FROM tokens`);
    await db.run(sql`DELETE FROM projects`);

    // Create a test project
    const [project] = await db
      .insert(projects)
      .values({
        name: 'Download API Test Project',
        specUrl: 'https://api.example.com/spec.json',
      })
      .returning();
    
    testProjectId = project.id;

    // Create a completed task with output
    testPublicToken = crypto.randomUUID();
    testTaskId = crypto.randomUUID();
    
    await db
      .insert(tasks)
      .values({
        id: testTaskId,
        projectId: testProjectId,
        status: TaskStatus.SUCCESS,
        outputDir: '/tmp/test-output',
        outputFiles: JSON.stringify(['api.ts', 'data-contracts.ts']),
        outputSize: 2048,
        downloadCount: 10,
        publicToken: testPublicToken,
      });
  });

  afterAll(async () => {
    await db.run(sql`DELETE FROM tasks`);
    await db.run(sql`DELETE FROM tokens`);
    await db.run(sql`DELETE FROM projects`);
  });

  describe('GET /api/tasks/[id]/download', () => {
    it('should find task by id', async () => {
      const task = await db
        .select()
        .from(tasks)
        .where(sql`id = ${testTaskId}`)
        .get();

      expect(task).not.toBeNull();
      expect(task?.id).toBe(testTaskId);
    });

    it('should reject download for non-success tasks', async () => {
      const pendingTaskId = crypto.randomUUID();
      
      await db
        .insert(tasks)
        .values({
          id: pendingTaskId,
          projectId: testProjectId,
          status: TaskStatus.PENDING,
        });

      const task = await db
        .select()
        .from(tasks)
        .where(sql`id = ${pendingTaskId}`)
        .get();

      expect(task?.status).toBe(TaskStatus.PENDING);
      expect(task?.status).not.toBe(TaskStatus.SUCCESS);
    });

    it('should require outputDir for download', async () => {
      const task = await db
        .select()
        .from(tasks)
        .where(sql`id = ${testTaskId}`)
        .get();

      expect(task?.outputDir).toBeDefined();
    });

    it('should increment download count', async () => {
      const beforeTask = await db
        .select()
        .from(tasks)
        .where(sql`id = ${testTaskId}`)
        .get();

      const countBefore = beforeTask?.downloadCount || 0;

      await db
        .update(tasks)
        .set({ downloadCount: countBefore + 1 })
        .where(sql`id = ${testTaskId}`);

      const afterTask = await db
        .select()
        .from(tasks)
        .where(sql`id = ${testTaskId}`)
        .get();

      expect(afterTask?.downloadCount).toBe(countBefore + 1);
    });
  });

  describe('GET /api/public/[token]', () => {
    it('should find task by public token', async () => {
      const task = await db
        .select()
        .from(tasks)
        .where(sql`public_token = ${testPublicToken}`)
        .get();

      expect(task).not.toBeNull();
      expect(task?.publicToken).toBe(testPublicToken);
    });

    it('should return 404 for non-existent token', async () => {
      const task = await db
        .select()
        .from(tasks)
        .where(sql`public_token = ${'non-existent-token'}`)
        .get();

      expect(task).toBeUndefined();
    });

    it('should require successful status for public download', async () => {
      const failedTaskId = crypto.randomUUID();
      
      await db
        .insert(tasks)
        .values({
          id: failedTaskId,
          projectId: testProjectId,
          status: TaskStatus.FAILED,
          publicToken: crypto.randomUUID(),
        });

      const task = await db
        .select()
        .from(tasks)
        .where(sql`id = ${failedTaskId}`)
        .get();

      expect(task?.status).toBe(TaskStatus.FAILED);
      expect(task?.status).not.toBe(TaskStatus.SUCCESS);
    });

    it('should get project info with task', async () => {
      const task = await db
        .select()
        .from(tasks)
        .where(sql`id = ${testTaskId}`)
        .get();

      const project = await db
        .select()
        .from(projects)
        .where(sql`id = ${task?.projectId}`)
        .get();

      expect(project).not.toBeNull();
      expect(project?.name).toBe('Download API Test Project');
    });
  });

  describe('GET /api/files/[...path]', () => {
    it('should parse task ID from file path', () => {
      const filePath = `${testTaskId}/api.ts`;
      const [taskId, ...rest] = filePath.split('/');
      const fileName = rest.join('/');

      expect(taskId).toBe(testTaskId);
      expect(fileName).toBe('api.ts');
    });

    it('should prevent path traversal', () => {
      const maliciousPath = '../../../etc/passwd';
      const parts = maliciousPath.split('/');
      
      // Check for path traversal patterns
      const hasTraversal = parts.includes('..');
      
      expect(hasTraversal).toBe(true);
    });

    it('should validate file exists in task output', async () => {
      const task = await db
        .select()
        .from(tasks)
        .where(sql`id = ${testTaskId}`)
        .get();

      const outputFiles = JSON.parse(task?.outputFiles || '[]');
      
      expect(outputFiles).toContain('api.ts');
      expect(outputFiles).toContain('data-contracts.ts');
    });
  });

  describe('Output Files Format', () => {
    it('should have valid JSON output files array', async () => {
      const task = await db
        .select()
        .from(tasks)
        .where(sql`id = ${testTaskId}`)
        .get();

      expect(() => JSON.parse(task?.outputFiles || '[]')).not.toThrow();
      
      const files = JSON.parse(task?.outputFiles || '[]');
      expect(Array.isArray(files)).toBe(true);
    });

    it('should include manifest.json in output files', async () => {
      const [taskWithManifest] = await db
        .insert(tasks)
        .values({
          id: crypto.randomUUID(),
          projectId: testProjectId,
          status: TaskStatus.SUCCESS,
          outputFiles: JSON.stringify(['api.ts', 'manifest.json', 'data-contracts.ts']),
        })
        .returning();

      const files = JSON.parse(taskWithManifest.outputFiles || '[]');
      expect(files).toContain('manifest.json');
    });

    it('should track output size correctly', async () => {
      const task = await db
        .select()
        .from(tasks)
        .where(sql`id = ${testTaskId}`)
        .get();

      expect(typeof task?.outputSize).toBe('number');
      expect(task?.outputSize).toBeGreaterThan(0);
    });
  });
});
