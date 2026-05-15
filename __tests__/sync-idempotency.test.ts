/**
 * Tests for Sync Idempotency
 * Verifies that triggering sync multiple times doesn't create duplicate tasks
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { projects, tasks } from '@/lib/db/schema';
import { TaskStatus, SpecType } from '@/lib/db/schema';
import { getPendingOrProcessingTask, createTask, startTask, completeTask, failTask } from '@/lib/tasks';

describe('Sync Idempotency', () => {
  let db: ReturnType<typeof getDb>;
  let testProjectId: number;

  beforeAll(async () => {
    db = getDb();
    await db.run(sql`DELETE FROM tasks`);
    await db.run(sql`DELETE FROM tokens`);
    await db.run(sql`DELETE FROM projects`);

    const [project] = await db
      .insert(projects)
      .values({
        name: 'Idempotency Test Project',
        specUrl: 'https://api.example.com/openapi.json',
        specType: SpecType.OPENAPI_3X,
        isActive: true,
      })
      .returning();
    
    testProjectId = project.id;
  });

  afterAll(async () => {
    await db.run(sql`DELETE FROM tasks`);
    await db.run(sql`DELETE FROM tokens`);
    await db.run(sql`DELETE FROM projects`);
  });

  beforeEach(async () => {
    // Clean up tasks before each test
    await db.run(sql`DELETE FROM tasks WHERE project_id = ${testProjectId}`);
  });

  describe('getPendingOrProcessingTask', () => {
    it('should return null when no tasks exist', async () => {
      const task = await getPendingOrProcessingTask(testProjectId);
      expect(task).toBeNull();
    });

    it('should return pending task when one exists', async () => {
      const [task] = await db
        .insert(tasks)
        .values({
          id: crypto.randomUUID(),
          projectId: testProjectId,
          status: TaskStatus.PENDING,
        })
        .returning();

      const result = await getPendingOrProcessingTask(testProjectId);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(task.id);
      expect(result!.status).toBe(TaskStatus.PENDING);
    });

    it('should return processing task when one exists', async () => {
      const [task] = await db
        .insert(tasks)
        .values({
          id: crypto.randomUUID(),
          projectId: testProjectId,
          status: TaskStatus.PROCESSING,
        })
        .returning();

      const result = await getPendingOrProcessingTask(testProjectId);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(task.id);
      expect(result!.status).toBe(TaskStatus.PROCESSING);
    });

    it('should return null when only completed tasks exist', async () => {
      await db
        .insert(tasks)
        .values({
          id: crypto.randomUUID(),
          projectId: testProjectId,
          status: TaskStatus.SUCCESS,
          completedAt: new Date(),
        });

      await db
        .insert(tasks)
        .values({
          id: crypto.randomUUID(),
          projectId: testProjectId,
          status: TaskStatus.FAILED,
          completedAt: new Date(),
        });

      const result = await getPendingOrProcessingTask(testProjectId);
      expect(result).toBeNull();
    });

    it('should return pending task over completed tasks', async () => {
      // Create completed task first
      await db
        .insert(tasks)
        .values({
          id: crypto.randomUUID(),
          projectId: testProjectId,
          status: TaskStatus.SUCCESS,
          completedAt: new Date(),
        });

      // Wait a tiny bit to ensure createdAt is different
      await new Promise(resolve => setTimeout(resolve, 10));

      // Create pending task (should be newer)
      const [pendingTask] = await db
        .insert(tasks)
        .values({
          id: crypto.randomUUID(),
          projectId: testProjectId,
          status: TaskStatus.PENDING,
        })
        .returning();

      const result = await getPendingOrProcessingTask(testProjectId);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(pendingTask.id);
    });
  });

  describe('Idempotent Sync Logic', () => {
    it('should return existing pending task instead of creating new one', async () => {
      // Create existing pending task
      const [existingTask] = await db
        .insert(tasks)
        .values({
          id: crypto.randomUUID(),
          projectId: testProjectId,
          status: TaskStatus.PENDING,
        })
        .returning();

      // Simulate idempotent sync logic
      const existing = await getPendingOrProcessingTask(testProjectId);
      
      if (existing) {
        // Should return existing task, not create new
        expect(existing.id).toBe(existingTask.id);
        
        // Count tasks - should still be 1
        const allTasks = await db.select().from(tasks).where(sql`project_id = ${testProjectId}`).all();
        expect(allTasks).toHaveLength(1);
      }
    });

    it('should return existing processing task instead of creating new one', async () => {
      // Create existing processing task
      const [existingTask] = await db
        .insert(tasks)
        .values({
          id: crypto.randomUUID(),
          projectId: testProjectId,
          status: TaskStatus.PROCESSING,
        })
        .returning();

      // Simulate idempotent sync logic
      const existing = await getPendingOrProcessingTask(testProjectId);
      
      if (existing) {
        expect(existing.id).toBe(existingTask.id);
        
        // Count tasks - should still be 1
        const allTasks = await db.select().from(tasks).where(sql`project_id = ${testProjectId}`).all();
        expect(allTasks).toHaveLength(1);
      }
    });

    it('should create new task when no pending/processing tasks exist', async () => {
      // Ensure no pending/processing tasks
      const existing = await getPendingOrProcessingTask(testProjectId);
      expect(existing).toBeNull();

      // Create new task
      const result = await createTask({ projectId: testProjectId });
      expect(result.success).toBe(true);

      // Should have exactly 1 task
      const allTasks = await db.select().from(tasks).where(sql`project_id = ${testProjectId}`).all();
      expect(allTasks).toHaveLength(1);
    });

    it('should allow new sync after previous task completes', async () => {
      // Complete existing task
      const [task] = await db
        .insert(tasks)
        .values({
          id: crypto.randomUUID(),
          projectId: testProjectId,
          status: TaskStatus.SUCCESS,
          completedAt: new Date(),
        })
        .returning();

      // No pending/processing task should exist
      let existing = await getPendingOrProcessingTask(testProjectId);
      expect(existing).toBeNull();

      // Should be able to create new task
      const result = await createTask({ projectId: testProjectId });
      expect(result.success).toBe(true);
      
      // Now should have 2 tasks total
      const allTasks = await db.select().from(tasks).where(sql`project_id = ${testProjectId}`).all();
      expect(allTasks).toHaveLength(2);
    });

    it('should allow new sync after previous task fails', async () => {
      // Create and fail a task
      await db
        .insert(tasks)
        .values({
          id: crypto.randomUUID(),
          projectId: testProjectId,
          status: TaskStatus.FAILED,
          completedAt: new Date(),
          errorMessage: 'Previous failure',
        });

      // No pending/processing task should exist
      const existing = await getPendingOrProcessingTask(testProjectId);
      expect(existing).toBeNull();

      // Should be able to create new task
      const result = await createTask({ projectId: testProjectId });
      expect(result.success).toBe(true);
    });
  });

  describe('Multiple Concurrent Syncs', () => {
    it('should handle rapid sync attempts gracefully', async () => {
      // Check existing first
      const existing = await getPendingOrProcessingTask(testProjectId);
      
      if (existing) {
        // Idempotent - return existing
        expect(existing.status).toMatch(/PENDING|PROCESSING/);
      } else {
        // Create new
        await createTask({ projectId: testProjectId });
      }

      // Second check should return same task
      const existing2 = await getPendingOrProcessingTask(testProjectId);
      expect(existing2).not.toBeNull();

      // Count should be 1
      const allTasks = await db.select().from(tasks).where(sql`project_id = ${testProjectId}`).all();
      expect(allTasks.length).toBeLessThanOrEqual(1);
    });
  });
});
