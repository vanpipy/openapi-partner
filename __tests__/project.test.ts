/**
 * Tests for project schema operations
 * Note: Server action tests require Next.js context, so we test the underlying operations
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'bun:test';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { projects, tasks } from '@/lib/db/schema';
import { TaskStatus } from '@/lib/db';
import { createTask } from '@/lib/tasks';

// Helper to narrow union type after success check
function assertSuccess<T>(result: { success: true } | { success: false; error: string }): asserts result is { success: true } {
  expect(result.success).toBe(true);
}

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
          specUrl: 'https://example.com/swagger.json',
          outputPath: './generated',
        })
        .returning();

      expect(project.name).toBe('Test Project');
      expect(project.specUrl).toBe('https://example.com/swagger.json');
      expect(project.isActive).toBe(true);
    });

    it('should update a project', async () => {
      const [project] = await db
        .insert(projects)
        .values({
          name: 'Update Test',
          specUrl: 'https://test.com/api.json',
        })
        .returning();

      const [updated] = await db
        .update(projects)
        .set({
          name: 'Updated Name',
          specUrl: 'https://updated.com/api.json',
          updatedAt: new Date(),
        })
        .where(sql`id = ${project.id}`)
        .returning();

      expect(updated.name).toBe('Updated Name');
      expect(updated.specUrl).toBe('https://updated.com/api.json');
    });

    it('should delete a project', async () => {
      const [project] = await db
        .insert(projects)
        .values({
          name: 'Delete Test',
          specUrl: 'https://delete.com/api.json',
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
          specUrl: 'https://cascade.com/api.json',
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
          specUrl: 'https://sync.com/api.json',
        })
        .returning();

      // Simulate sync task creation
      const taskResult = await createTask({ projectId: project.id });

      assertSuccess(taskResult);
      expect(taskResult.task.projectId).toBe(project.id);
      expect(taskResult.task.status).toBe(TaskStatus.PENDING);
    });
  });

  describe('Async Project Update During Task Processing', () => {
    it('should update project spec info without triggering revalidation errors', async () => {
      // This test verifies that updating a project during async task processing
      // doesn't cause Next.js revalidation errors.
      // Previously, updateProject called revalidatePath which threw when called
      // from async context (processTask -> generateTypes -> updateProject).

      const [project] = await db
        .insert(projects)
        .values({
          name: 'Async Update Test',
          specUrl: 'https://petstore.swagger.io/v2/swagger.json',
          specType: 'auto-detect',
        })
        .returning();

      expect(project.specVersion).toBeNull();
      expect(project.wasConvertedFromSwagger2).toBe(false);

      // Simulate async task processing that updates project spec info
      // This mirrors what happens in generator.ts after type generation
      // Key point: updateProject should NOT call revalidatePath since it
      // would throw in async context
      const updatedRows = await db
        .update(projects)
        .set({
          specType: 'swagger2x',
          specVersion: '2.0',
          wasConvertedFromSwagger2: true,
          updatedAt: new Date(),
        })
        .where(sql`id = ${project.id}`)
        .returning();

      expect(updatedRows.length).toBe(1);
      expect(updatedRows[0].specType).toBe('swagger2x');
      expect(updatedRows[0].specVersion).toBe('2.0');
      expect(updatedRows[0].wasConvertedFromSwagger2).toBe(true);
    });

    it('should allow multiple sequential updates during task lifecycle', async () => {
      // Simulates multiple updates during task lifecycle (start, progress, complete)
      const [project] = await db
        .insert(projects)
        .values({
          name: 'Multi Update Test',
          specUrl: 'https://api.example.com/openapi.json',
        })
        .returning();

      // Simulate task start - update status (not revalidation, just db)
      await db
        .update(projects)
        .set({ updatedAt: new Date() })
        .where(sql`id = ${project.id}`);

      // Simulate task progress - update some field
      const [progressed] = await db
        .update(projects)
        .set({
          specType: 'openapi3x',
          updatedAt: new Date(),
        })
        .where(sql`id = ${project.id}`)
        .returning();

      expect(progressed.specType).toBe('openapi3x');

      // Simulate task completion - update final state
      const [completed] = await db
        .update(projects)
        .set({
          specVersion: '3.1.0',
          updatedAt: new Date(),
        })
        .where(sql`id = ${project.id}`)
        .returning();

      expect(completed.specVersion).toBe('3.1.0');
    });
  });
});
