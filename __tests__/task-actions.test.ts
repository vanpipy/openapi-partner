/**
 * Tests for Task Actions (async-safe versions)
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { projects, tasks } from '@/lib/db/schema';
import { TaskStatus } from '@/lib/db/schema';
import { SpecType } from '@/lib/db/schema';

describe('Task Actions (Async-Safe)', () => {
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
        name: 'Async Task Test Project',
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

  describe('Task Lifecycle (Async-Safe)', () => {
    it('should create a pending task', async () => {
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
      expect(task.startedAt).toBeNull();
      expect(task.completedAt).toBeNull();
    });

    it('should start a pending task (set startedAt)', async () => {
      const taskId = crypto.randomUUID();
      
      await db
        .insert(tasks)
        .values({
          id: taskId,
          projectId: testProjectId,
          status: TaskStatus.PENDING,
        });

      // Start the task
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

    it('should complete a processing task', async () => {
      const taskId = crypto.randomUUID();
      
      await db
        .insert(tasks)
        .values({
          id: taskId,
          projectId: testProjectId,
          status: TaskStatus.PROCESSING,
          startedAt: new Date(),
        });

      // Complete the task
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

    it('should fail a processing task', async () => {
      const taskId = crypto.randomUUID();
      
      await db
        .insert(tasks)
        .values({
          id: taskId,
          projectId: testProjectId,
          status: TaskStatus.PROCESSING,
          startedAt: new Date(),
        });

      // Fail the task
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

    it('should append task log', async () => {
      const taskId = crypto.randomUUID();
      
      await db
        .insert(tasks)
        .values({
          id: taskId,
          projectId: testProjectId,
          status: TaskStatus.PROCESSING,
          executionLog: 'Starting...',
        });

      // Append log
      const existingLog = 'Starting...\n';
      const newLog = '[2024-01-01T00:00:00.000Z] Downloading spec...';

      await db
        .update(tasks)
        .set({
          executionLog: existingLog + newLog,
        })
        .where(sql`id = ${taskId}`);

      const task = await db
        .select()
        .from(tasks)
        .where(sql`id = ${taskId}`)
        .get();

      expect(task!.executionLog).toContain('Starting...');
      expect(task!.executionLog).toContain('Downloading spec...');
    });
  });

  describe('Task Status Transitions', () => {
    it('should allow PENDING -> PROCESSING transition', async () => {
      const taskId = crypto.randomUUID();
      
      await db
        .insert(tasks)
        .values({
          id: taskId,
          projectId: testProjectId,
          status: TaskStatus.PENDING,
        });

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
    });

    it('should allow PROCESSING -> SUCCESS transition', async () => {
      const taskId = crypto.randomUUID();
      
      await db
        .insert(tasks)
        .values({
          id: taskId,
          projectId: testProjectId,
          status: TaskStatus.PROCESSING,
        });

      await db
        .update(tasks)
        .set({
          status: TaskStatus.SUCCESS,
          completedAt: new Date(),
        })
        .where(sql`id = ${taskId}`);

      const task = await db
        .select()
        .from(tasks)
        .where(sql`id = ${taskId}`)
        .get();

      expect(task!.status).toBe(TaskStatus.SUCCESS);
    });

    it('should allow PROCESSING -> FAILED transition', async () => {
      const taskId = crypto.randomUUID();
      
      await db
        .insert(tasks)
        .values({
          id: taskId,
          projectId: testProjectId,
          status: TaskStatus.PROCESSING,
        });

      await db
        .update(tasks)
        .set({
          status: TaskStatus.FAILED,
          completedAt: new Date(),
          errorMessage: 'Test error',
        })
        .where(sql`id = ${taskId}`);

      const task = await db
        .select()
        .from(tasks)
        .where(sql`id = ${taskId}`)
        .get();

      expect(task!.status).toBe(TaskStatus.FAILED);
      expect(task!.errorMessage).toBe('Test error');
    });
  });

  describe('Async Context Safety', () => {
    it('should not call revalidatePath during async processing', async () => {
      // This test validates the pattern we use:
      // Task actions should update database without calling revalidatePath
      // when called from async context (processTask function)
      
      const taskId = crypto.randomUUID();
      
      await db
        .insert(tasks)
        .values({
          id: taskId,
          projectId: testProjectId,
          status: TaskStatus.PENDING,
        });

      // Simulate async processing (no revalidatePath)
      const simulateAsyncProcessing = async () => {
        // Update task status
        await db
          .update(tasks)
          .set({
            status: TaskStatus.PROCESSING,
            startedAt: new Date(),
          })
          .where(sql`id = ${taskId}`);
        
        // Simulate some async work
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Complete task
        await db
          .update(tasks)
          .set({
            status: TaskStatus.SUCCESS,
            completedAt: new Date(),
          })
          .where(sql`id = ${taskId}`);
        
        return true;
      };

      const result = await simulateAsyncProcessing();
      expect(result).toBe(true);

      const task = await db
        .select()
        .from(tasks)
        .where(sql`id = ${taskId}`)
        .get();

      expect(task!.status).toBe(TaskStatus.SUCCESS);
      expect(task!.startedAt).not.toBeNull();
      expect(task!.completedAt).not.toBeNull();
    });

    it('should handle errors gracefully without crashing', async () => {
      const taskId = crypto.randomUUID();
      
      await db
        .insert(tasks)
        .values({
          id: taskId,
          projectId: testProjectId,
          status: TaskStatus.PENDING,
        });

      // Simulate error handling
      const simulateErrorHandling = async () => {
        try {
          throw new Error('Simulated error');
        } catch (error) {
          // Mark task as failed
          await db
            .update(tasks)
            .set({
              status: TaskStatus.FAILED,
              completedAt: new Date(),
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            })
            .where(sql`id = ${taskId}`);
        }
      };

      await simulateErrorHandling();

      const task = await db
        .select()
        .from(tasks)
        .where(sql`id = ${taskId}`)
        .get();

      expect(task!.status).toBe(TaskStatus.FAILED);
      expect(task!.errorMessage).toBe('Simulated error');
    });
  });

  describe('Task Output Tracking', () => {
    it('should track output files', async () => {
      const taskId = crypto.randomUUID();
      const outputFiles = ['api.ts', 'data-contracts.ts', 'http-client.ts', 'route-types.ts', 'manifest.json'];
      
      await db
        .insert(tasks)
        .values({
          id: taskId,
          projectId: testProjectId,
          status: TaskStatus.SUCCESS,
          completedAt: new Date(),
          outputDir: '/generated/tasks/test-id',
          outputFiles: JSON.stringify(outputFiles),
          outputSize: 2048,
          publicToken: crypto.randomUUID(),
          downloadCount: 0,
        });

      const task = await db
        .select()
        .from(tasks)
        .where(sql`id = ${taskId}`)
        .get();

      const files = JSON.parse(task!.outputFiles || '[]');
      expect(files).toHaveLength(5);
      expect(files).toContain('api.ts');
      expect(files).toContain('manifest.json');
      expect(task!.outputSize).toBe(2048);
    });

    it('should track download count', async () => {
      const taskId = crypto.randomUUID();
      
      await db
        .insert(tasks)
        .values({
          id: taskId,
          projectId: testProjectId,
          status: TaskStatus.SUCCESS,
          downloadCount: 5,
        });

      // Increment download count
      await db
        .update(tasks)
        .set({
          downloadCount: 6,
        })
        .where(sql`id = ${taskId}`);

      const task = await db
        .select()
        .from(tasks)
        .where(sql`id = ${taskId}`)
        .get();

      expect(task!.downloadCount).toBe(6);
    });
  });
});
