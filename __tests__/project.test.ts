/**
 * Tests for project schema operations
 * Note: Server action tests require Next.js context, so we test the underlying operations
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { projects, tasks } from '@/lib/db/schema';
import { TaskStatus } from '@/lib/db';
import { createTask } from '@/lib/tasks';

describe('Project Operations', () => {
  let db: ReturnType<typeof getDb>;

  beforeAll(async () => {
    db = getDb();
    await db.run(sql`DELETE FROM tasks`);
    await db.run(sql`DELETE FROM tokens`);
    await db.run(sql`DELETE FROM projects`);
  });

  afterAll(async () => {
    await db.run(sql`DELETE FROM tasks`);
    await db.run(sql`DELETE FROM tokens`);
    await db.run(sql`DELETE FROM projects`);
  });

  describe('Project CRUD', () => {
    it('should create a project', async () => {
      const [project] = await db
        .insert(projects)
        .values({
          name: 'Test Project',
          swaggerUrl: 'https://example.com/swagger.json',
          outputPath: './generated',
        })
        .returning();

      expect(project.name).toBe('Test Project');
      expect(project.swaggerUrl).toBe('https://example.com/swagger.json');
      expect(project.isActive).toBe(true);
    });

    it('should update a project', async () => {
      const [project] = await db
        .insert(projects)
        .values({
          name: 'Update Test',
          swaggerUrl: 'https://test.com/api.json',
        })
        .returning();

      const [updated] = await db
        .update(projects)
        .set({
          name: 'Updated Name',
          swaggerUrl: 'https://updated.com/api.json',
          updatedAt: new Date(),
        })
        .where(sql`id = ${project.id}`)
        .returning();

      expect(updated.name).toBe('Updated Name');
      expect(updated.swaggerUrl).toBe('https://updated.com/api.json');
    });

    it('should delete a project', async () => {
      const [project] = await db
        .insert(projects)
        .values({
          name: 'Delete Test',
          swaggerUrl: 'https://delete.com/api.json',
        })
        .returning();

      await db.delete(projects).where(sql`id = ${project.id}`);

      const deleted = await db
        .select()
        .from(projects)
        .where(sql`id = ${project.id}`)
        .get();

      expect(deleted).toBeUndefined();
    });

    it('should cascade delete tasks when project is deleted', async () => {
      const [project] = await db
        .insert(projects)
        .values({
          name: 'Cascade Test',
          swaggerUrl: 'https://cascade.com/api.json',
        })
        .returning();

      // Create a task
      await db.insert(tasks).values({
        id: crypto.randomUUID(),
        projectId: project.id,
        status: TaskStatus.PENDING,
      });

      // Delete project
      await db.delete(projects).where(sql`id = ${project.id}`);

      // Check tasks are deleted
      const remainingTasks = await db
        .select()
        .from(tasks)
        .where(sql`project_id = ${project.id}`)
        .all();

      expect(remainingTasks.length).toBe(0);
    });
  });

  describe('Project Task Integration', () => {
    it('should create a task when syncing project', async () => {
      const [project] = await db
        .insert(projects)
        .values({
          name: 'Sync Test',
          swaggerUrl: 'https://sync.com/api.json',
        })
        .returning();

      // Simulate sync task creation
      const taskResult = await createTask({ projectId: project.id });

      expect(taskResult.success).toBe(true);
      expect(taskResult.task.projectId).toBe(project.id);
      expect(taskResult.task.status).toBe(TaskStatus.PENDING);
    });
  });
});
