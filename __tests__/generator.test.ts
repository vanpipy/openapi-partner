/**
 * Tests for generator module
 * Tests the underlying logic without requiring full swagger-typescript-api
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { projects, tasks } from '@/lib/db/schema';
import { TaskStatus } from '@/lib/db';

describe('Generator Logic', () => {
  let db: ReturnType<typeof getDb>;

  beforeAll(async () => {
    db = getDb();
  });

  afterAll(async () => {
    await db.run(sql`DELETE FROM tasks`);
    await db.run(sql`DELETE FROM tokens`);
    await db.run(sql`DELETE FROM projects`);
  });

  describe('Task Lifecycle', () => {
    it('should track task through lifecycle', async () => {
      // Create project
      const [project] = await db
        .insert(projects)
        .values({
          name: 'Generator Lifecycle Test',
          specUrl: 'https://example.com/swagger.json',
        })
        .returning();

      // Create task
      const taskId = crypto.randomUUID();
      const [task] = await db
        .insert(tasks)
        .values({
          id: taskId,
          projectId: project.id,
          status: TaskStatus.PENDING,
        })
        .returning();

      expect(task.status).toBe(TaskStatus.PENDING);

      // Update to processing
      const [processing] = await db
        .update(tasks)
        .set({
          status: TaskStatus.PROCESSING,
          startedAt: new Date(),
        })
        .where(sql`id = ${taskId}`)
        .returning();

      expect(processing.status).toBe(TaskStatus.PROCESSING);
      expect(processing.startedAt).toBeDefined();

      // Update to success
      const [success] = await db
        .update(tasks)
        .set({
          status: TaskStatus.SUCCESS,
          completedAt: new Date(),
          executionLog: 'Type generation completed successfully',
        })
        .where(sql`id = ${taskId}`)
        .returning();

      expect(success.status).toBe(TaskStatus.SUCCESS);
      expect(success.completedAt).toBeDefined();
      expect(success.executionLog).toContain('completed');
    });

    it('should handle failed task', async () => {
      const [project] = await db
        .insert(projects)
        .values({
          name: 'Generator Failure Test',
          specUrl: 'https://fail.com/swagger.json',
        })
        .returning();

      const taskId = crypto.randomUUID();
      await db.insert(tasks).values({
        id: taskId,
        projectId: project.id,
        status: TaskStatus.PROCESSING,
        startedAt: new Date(),
      });

      // Simulate failure
      const [failed] = await db
        .update(tasks)
        .set({
          status: TaskStatus.FAILED,
          completedAt: new Date(),
          errorMessage: 'Network timeout while fetching OpenAPI spec',
        })
        .where(sql`id = ${taskId}`)
        .returning();

      expect(failed.status).toBe(TaskStatus.FAILED);
      expect(failed.errorMessage).toContain('Network timeout');
    });
  });

  describe('Execution Log', () => {
    it('should track execution progress', async () => {
      const [project] = await db
        .insert(projects)
        .values({
          name: 'Progress Test',
          specUrl: 'https://progress.com/swagger.json',
        })
        .returning();

      const taskId = crypto.randomUUID();
      await db.insert(tasks).values({
        id: taskId,
        projectId: project.id,
        status: TaskStatus.PROCESSING,
        startedAt: new Date(),
      });

      // Simulate progress updates
      const log1 = '[2024-01-01T10:00:00Z] Fetching OpenAPI spec...\n';
      const log2 = log1 + '[2024-01-01T10:00:01Z] Parsing schema...\n';
      const log3 = log2 + '[2024-01-01T10:00:02Z] Generating types...\n';

      await db
        .update(tasks)
        .set({ executionLog: log3 })
        .where(sql`id = ${taskId}`);

      const updated = await db
        .select()
        .from(tasks)
        .where(sql`id = ${taskId}`)
        .get();

      expect(updated?.executionLog).toContain('Fetching OpenAPI spec');
      expect(updated?.executionLog).toContain('Parsing schema');
      expect(updated?.executionLog).toContain('Generating types');
    });
  });
});
