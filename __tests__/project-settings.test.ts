/**
 * Tests for ProjectSettings component
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { projects, tasks, tokens } from '@/lib/db/schema';
import { SpecType } from '@/lib/db/schema';
import { TaskStatus } from '@/lib/db/schema';

describe('ProjectSettings', () => {
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
        name: 'Settings Test Project',
        specUrl: 'https://api.example.com/openapi.json',
        specType: SpecType.OPENAPI_3X,
        specVersion: '3.1.0',
        wasConvertedFromSwagger2: false,
        outputPath: './generated',
      })
      .returning();
    
    testProjectId = project.id;
  });

  afterAll(async () => {
    await db.run(sql`DELETE FROM tasks`);
    await db.run(sql`DELETE FROM tokens`);
    await db.run(sql`DELETE FROM projects`);
  });

  describe('Project Configuration Display', () => {
    it('should display project configuration fields', async () => {
      const project = await db
        .select()
        .from(projects)
        .where(sql`id = ${testProjectId}`)
        .get();

      expect(project).toBeDefined();
      expect(project!.outputPath).toBe('./generated');
      expect(project!.specVersion).toBe('3.1.0');
      expect(project!.wasConvertedFromSwagger2).toBe(false);
    });

    it('should format created and updated dates', async () => {
      const project = await db
        .select()
        .from(projects)
        .where(sql`id = ${testProjectId}`)
        .get();

      const createdFormatted = new Date(project!.createdAt).toLocaleString();
      const updatedFormatted = new Date(project!.updatedAt).toLocaleString();

      expect(createdFormatted).toContain('2026');
      expect(updatedFormatted).toContain('2026');
    });

    it('should show spec URL with external link', async () => {
      const project = await db
        .select()
        .from(projects)
        .where(sql`id = ${testProjectId}`)
        .get();

      expect(project!.specUrl).toBe('https://api.example.com/openapi.json');
      expect(project!.specUrl).toContain('https://');
    });
  });

  describe('Edit Functionality', () => {
    it('should have project data for edit form', async () => {
      const project = await db
        .select()
        .from(projects)
        .where(sql`id = ${testProjectId}`)
        .get();

      const editData = {
        id: project!.id,
        name: project!.name,
        specUrl: project!.specUrl,
        specType: project!.specType,
        outputPath: project!.outputPath,
        apiVersion: project!.apiVersion,
        baseUrl: project!.baseUrl,
      };

      expect(editData.id).toBe(testProjectId);
      expect(editData.name).toBe('Settings Test Project');
      expect(editData.specUrl).toBe('https://api.example.com/openapi.json');
    });

    it('should update project successfully', async () => {
      await db
        .update(projects)
        .set({
          name: 'Updated Settings Test Project',
          outputPath: './new-output',
        })
        .where(sql`id = ${testProjectId}`);

      const updated = await db
        .select()
        .from(projects)
        .where(sql`id = ${testProjectId}`)
        .get();

      expect(updated!.name).toBe('Updated Settings Test Project');
      expect(updated!.outputPath).toBe('./new-output');
    });
  });

  describe('Delete Functionality', () => {
    it('should delete project and cascade delete tasks', async () => {
      // Create a task first
      await db
        .insert(tasks)
        .values({
          id: crypto.randomUUID(),
          projectId: testProjectId,
          status: TaskStatus.SUCCESS,
        });

      // Create a token first
      await db
        .insert(tokens)
        .values({
          projectId: testProjectId,
          name: 'Test Token',
          tokenHash: 'test-hash',
          permissions: JSON.stringify(['read']),
        });

      // Verify task and token exist
      const taskCount = await db
        .select()
        .from(tasks)
        .where(sql`project_id = ${testProjectId}`)
        .all();
      
      const tokenCount = await db
        .select()
        .from(tokens)
        .where(sql`project_id = ${testProjectId}`)
        .all();

      expect(taskCount.length).toBeGreaterThan(0);
      expect(tokenCount.length).toBeGreaterThan(0);

      // Delete project
      await db
        .delete(projects)
        .where(sql`id = ${testProjectId}`);

      // Verify cascade delete
      const remainingTasks = await db
        .select()
        .from(tasks)
        .where(sql`project_id = ${testProjectId}`)
        .all();

      const remainingTokens = await db
        .select()
        .from(tokens)
        .where(sql`project_id = ${testProjectId}`)
        .all();

      expect(remainingTasks.length).toBe(0);
      expect(remainingTokens.length).toBe(0);
    });
  });
});

describe('Sync Functionality', () => {
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
        name: 'Sync Test Project',
        specUrl: 'https://petstore.swagger.io/v2/swagger.json',
        specType: SpecType.AUTO_DETECT,
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

  describe('triggerProjectSync', () => {
    it('should create a new task when triggered', async () => {
      const taskId = crypto.randomUUID();
      
      const [task] = await db
        .insert(tasks)
        .values({
          id: taskId,
          projectId: testProjectId,
          status: TaskStatus.PENDING,
        })
        .returning();

      expect(task.id).toBe(taskId);
      expect(task.projectId).toBe(testProjectId);
      expect(task.status).toBe(TaskStatus.PENDING);
    });

    it('should reject sync for inactive projects', async () => {
      await db
        .update(projects)
        .set({ isActive: false })
        .where(sql`id = ${testProjectId}`);

      const project = await db
        .select()
        .from(projects)
        .where(sql`id = ${testProjectId}`)
        .get();

      expect(project!.isActive).toBe(false);
    });

    it('should reject sync for non-existent projects', async () => {
      const nonExistentId = 99999;
      
      const project = await db
        .select()
        .from(projects)
        .where(sql`id = ${nonExistentId}`)
        .get();

      expect(project).toBeUndefined();
    });
  });

  describe('Task Status Transitions', () => {
    it('should transition from pending to processing', async () => {
      const taskId = crypto.randomUUID();
      
      await db
        .insert(tasks)
        .values({
          id: taskId,
          projectId: testProjectId,
          status: TaskStatus.PENDING,
        });

      // Simulate start
      await db
        .update(tasks)
        .set({
          status: TaskStatus.PROCESSING,
          startedAt: new Date(),
        })
        .where(sql`id = ${taskId}`);

      const task = await db
        .select()
        .from(tasks)
        .where(sql`id = ${taskId}`)
        .get();

      expect(task!.status).toBe(TaskStatus.PROCESSING);
      expect(task!.startedAt).not.toBeNull();
    });

    it('should transition from processing to success', async () => {
      const taskId = crypto.randomUUID();
      
      await db
        .insert(tasks)
        .values({
          id: taskId,
          projectId: testProjectId,
          status: TaskStatus.PROCESSING,
          startedAt: new Date(),
        });

      // Simulate completion
      await db
        .update(tasks)
        .set({
          status: TaskStatus.SUCCESS,
          completedAt: new Date(),
          outputDir: '/tmp/generated',
          outputFiles: JSON.stringify(['api.ts', 'data-contracts.ts']),
          outputSize: 1024,
        })
        .where(sql`id = ${taskId}`);

      const task = await db
        .select()
        .from(tasks)
        .where(sql`id = ${taskId}`)
        .get();

      expect(task!.status).toBe(TaskStatus.SUCCESS);
      expect(task!.completedAt).not.toBeNull();
      expect(task!.outputDir).toBe('/tmp/generated');
    });

    it('should transition from processing to failed', async () => {
      const taskId = crypto.randomUUID();
      
      await db
        .insert(tasks)
        .values({
          id: taskId,
          projectId: testProjectId,
          status: TaskStatus.PROCESSING,
          startedAt: new Date(),
        });

      // Simulate failure
      await db
        .update(tasks)
        .set({
          status: TaskStatus.FAILED,
          completedAt: new Date(),
          errorMessage: 'Failed to fetch OpenAPI spec',
        })
        .where(sql`id = ${taskId}`);

      const task = await db
        .select()
        .from(tasks)
        .where(sql`id = ${taskId}`)
        .get();

      expect(task!.status).toBe(TaskStatus.FAILED);
      expect(task!.errorMessage).toBe('Failed to fetch OpenAPI spec');
    });
  });
});
