/**
 * Tests for task output files functionality
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { projects, tasks } from '@/lib/db/schema';
import { TaskStatus } from '@/lib/db/schema';

describe('Task Output Files', () => {
  let db: ReturnType<typeof getDb>;
  let testProjectId: number;

  beforeAll(async () => {
    db = getDb();
    await db.run(sql`DELETE FROM tasks`);
    await db.run(sql`DELETE FROM tokens`);
    await db.run(sql`DELETE FROM projects`);

    // Create a test project
    const [project] = await db
      .insert(projects)
      .values({
        name: 'Output Test Project',
        specUrl: 'https://api.example.com/spec.json',
      })
      .returning();
    
    testProjectId = project.id;
  });

  afterAll(async () => {
    await db.run(sql`DELETE FROM tasks`);
    await db.run(sql`DELETE FROM tokens`);
    await db.run(sql`DELETE FROM projects`);
  });

  describe('Task Output Fields', () => {
    it('should create task with output fields', async () => {
      const [task] = await db
        .insert(tasks)
        .values({
          id: crypto.randomUUID(),
          projectId: testProjectId,
          status: TaskStatus.SUCCESS,
          outputDir: '/generated/tasks/test-task-id',
          outputFiles: JSON.stringify(['api.ts', 'data-contracts.ts', 'http-client.ts']),
          outputSize: 1024,
          downloadCount: 0,
          publicToken: crypto.randomUUID(),
        })
        .returning();

      expect(task.outputDir).toBe('/generated/tasks/test-task-id');
      expect(task.outputFiles).toBe(JSON.stringify(['api.ts', 'data-contracts.ts', 'http-client.ts']));
      expect(task.outputSize).toBe(1024);
      expect(task.downloadCount).toBe(0);
      expect(task.publicToken).toBeDefined();
    });

    it('should update download count', async () => {
      const [task] = await db
        .insert(tasks)
        .values({
          id: crypto.randomUUID(),
          projectId: testProjectId,
          status: TaskStatus.SUCCESS,
          downloadCount: 5,
        })
        .returning();

      expect(task.downloadCount).toBe(5);

      // Increment download count
      await db
        .update(tasks)
        .set({ downloadCount: (task.downloadCount || 0) + 1 })
        .where(sql`id = ${task.id}`);

      const updated = await db
        .select()
        .from(tasks)
        .where(sql`id = ${task.id}`)
        .get();

      expect(updated?.downloadCount).toBe(6);
    });

    it('should parse output files JSON', async () => {
      const [task] = await db
        .insert(tasks)
        .values({
          id: crypto.randomUUID(),
          projectId: testProjectId,
          status: TaskStatus.SUCCESS,
          outputFiles: JSON.stringify(['api.ts', 'data-contracts.ts', 'http-client.ts', 'route-types.ts', 'manifest.json']),
        })
        .returning();

      const files = JSON.parse(task.outputFiles || '[]');
      
      expect(files).toHaveLength(5);
      expect(files).toContain('api.ts');
      expect(files).toContain('manifest.json');
      expect(files).toContain('data-contracts.ts');
    });

    it('should handle empty output files', async () => {
      const [task] = await db
        .insert(tasks)
        .values({
          id: crypto.randomUUID(),
          projectId: testProjectId,
          status: TaskStatus.PENDING,
        })
        .returning();

      expect(task.outputFiles).toBeNull();
      expect(task.outputDir).toBeNull();
      expect(task.outputSize).toBeNull();
    });

    it('should generate unique public tokens', async () => {
      const [task1] = await db
        .insert(tasks)
        .values({
          id: crypto.randomUUID(),
          projectId: testProjectId,
          status: TaskStatus.SUCCESS,
          publicToken: crypto.randomUUID(),
        })
        .returning();

      const [task2] = await db
        .insert(tasks)
        .values({
          id: crypto.randomUUID(),
          projectId: testProjectId,
          status: TaskStatus.SUCCESS,
          publicToken: crypto.randomUUID(),
        })
        .returning();

      expect(task1.publicToken).not.toBe(task2.publicToken);
    });

    it('should find task by public token', async () => {
      const publicToken = crypto.randomUUID();
      
      await db
        .insert(tasks)
        .values({
          id: crypto.randomUUID(),
          projectId: testProjectId,
          status: TaskStatus.SUCCESS,
          publicToken,
        });

      const task = await db
        .select()
        .from(tasks)
        .where(sql`public_token = ${publicToken}`)
        .get();

      expect(task).not.toBeNull();
      expect(task?.publicToken).toBe(publicToken);
    });
  });

  describe('Task Status with Output', () => {
    it('should allow output fields for all statuses', async () => {
      const statuses = [
        TaskStatus.PENDING,
        TaskStatus.PROCESSING,
        TaskStatus.SUCCESS,
        TaskStatus.FAILED,
      ];

      for (const status of statuses) {
        const [task] = await db
          .insert(tasks)
          .values({
            id: crypto.randomUUID(),
            projectId: testProjectId,
            status,
            outputDir: status === TaskStatus.SUCCESS ? '/output/path' : null,
            outputFiles: status === TaskStatus.SUCCESS ? '[]' : null,
          })
          .returning();

        expect(task.status).toBe(status);
      }
    });
  });
});
