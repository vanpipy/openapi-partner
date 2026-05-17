/**
 * Tests for task management module
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import {
  createTask,
  startTask,
  completeTask,
  failTask,
  appendTaskLog,
  getTask,
  listProjectTasks,
  getLatestTask,
  countTasksByStatus,
  createTaskEvent,
  TaskStatus,
} from './tasks';
import { getDb } from './db';
import { projects, tasks } from './db/schema';

// Helper to narrow union type after success check
function assertSuccess<T>(result: { success: true } | { success: false; error: string }): asserts result is { success: true } {
  expect(result.success).toBe(true);
}

// Helper to narrow union type after failure check
function assertFailure<T>(result: { success: true } | { success: false; error: string }): asserts result is { success: false; error: string } {
  expect(result.success).toBe(false);
}

describe('Task Creation', () => {
  let db: ReturnType<typeof getDb>;
  let testProjectId: number;

  beforeAll(async () => {
    db = getDb();

    // Clean up
    await db.run(sql`DELETE FROM tasks`);
    await db.run(sql`DELETE FROM projects`);

    // Create test project
    const [project] = await db
      .insert(projects)
      .values({
        name: 'Task Test Project',
        specUrl: 'https://example.com/swagger.json',
      })
      .returning();
    testProjectId = project.id;
  });

  afterAll(async () => {
    await db.run(sql`DELETE FROM tasks`);
    await db.run(sql`DELETE FROM projects`);
  });

  it('should create a task with pending status', async () => {
    const result = await createTask({ projectId: testProjectId });

    assertSuccess(result);
    expect(result.task.status).toBe(TaskStatus.PENDING);
    expect(result.task.id).toBeDefined();
    expect(result.task.projectId).toBe(testProjectId);
    expect(result.task.createdAt).toBeInstanceOf(Date);
    expect(result.task.startedAt).toBeNull();
    expect(result.task.completedAt).toBeNull();
  });

  it('should fail when project does not exist', async () => {
    const result = await createTask({ projectId: 99999 });

    assertFailure(result);
    expect(result.error).toBe('Project not found');
  });
});

describe('Task Status Updates', () => {
  let db: ReturnType<typeof getDb>;
  let testProjectId: number;
  let testTaskId: string;

  beforeAll(async () => {
    db = getDb();

    // Clean up
    await db.run(sql`DELETE FROM tasks`);
    await db.run(sql`DELETE FROM projects`);

    // Create test project and task
    const [project] = await db
      .insert(projects)
      .values({
        name: 'Status Test Project',
        specUrl: 'https://example.com/swagger.json',
      })
      .returning();
    testProjectId = project.id;

    const [task] = await db
      .insert(tasks)
      .values({
        id: crypto.randomUUID(),
        projectId: testProjectId,
        status: TaskStatus.PENDING,
      })
      .returning();
    testTaskId = task.id;
  });

  afterAll(async () => {
    await db.run(sql`DELETE FROM tasks`);
    await db.run(sql`DELETE FROM projects`);
  });

  it('should start a pending task', async () => {
    const result = await startTask(testTaskId);

    assertSuccess(result);
    expect(result.task.status).toBe(TaskStatus.PROCESSING);
    expect(result.task.startedAt).toBeInstanceOf(Date);
  });

  it('should complete a processing task', async () => {
    const result = await completeTask(testTaskId, 'Generation completed successfully');

    assertSuccess(result);
    expect(result.task.status).toBe(TaskStatus.SUCCESS);
    expect(result.task.completedAt).toBeInstanceOf(Date);
    expect(result.task.executionLog).toContain('Generation completed successfully');
  });

  it('should fail a task with error message', async () => {
    // Create a new task to fail
    const [task] = await db
      .insert(tasks)
      .values({
        id: crypto.randomUUID(),
        projectId: testProjectId,
        status: TaskStatus.PROCESSING,
      })
      .returning();

    const result = await failTask(task.id, 'Network timeout');

    assertSuccess(result);
    expect(result.task.status).toBe(TaskStatus.FAILED);
    expect(result.task.errorMessage).toBe('Network timeout');
    expect(result.task.completedAt).toBeInstanceOf(Date);
  });
});

describe('Task Queries', () => {
  let db: ReturnType<typeof getDb>;
  let testProjectId: number;

  beforeAll(async () => {
    db = getDb();

    // Clean up
    await db.run(sql`DELETE FROM tasks`);
    await db.run(sql`DELETE FROM projects`);

    // Create test project
    const [project] = await db
      .insert(projects)
      .values({
        name: 'Query Test Project',
        specUrl: 'https://example.com/swagger.json',
      })
      .returning();
    testProjectId = project.id;

    // Create multiple tasks with different statuses
    await db.insert(tasks).values({
      id: crypto.randomUUID(),
      projectId: testProjectId,
      status: TaskStatus.SUCCESS,
    });

    await db.insert(tasks).values({
      id: crypto.randomUUID(),
      projectId: testProjectId,
      status: TaskStatus.FAILED,
    });

    await db.insert(tasks).values({
      id: crypto.randomUUID(),
      projectId: testProjectId,
      status: TaskStatus.PENDING,
    });
  });

  afterAll(async () => {
    await db.run(sql`DELETE FROM tasks`);
    await db.run(sql`DELETE FROM projects`);
  });

  it('should list all tasks for a project', async () => {
    const taskList = await listProjectTasks(testProjectId);
    expect(taskList.length).toBeGreaterThanOrEqual(3);
  });

  it('should get the latest task', async () => {
    const latest = await getLatestTask(testProjectId);
    expect(latest).not.toBeNull();
    // The latest task should be one of the statuses we created
    const validStatuses: TaskStatus[] = [TaskStatus.PENDING, TaskStatus.SUCCESS, TaskStatus.FAILED];
    expect(validStatuses).toContain(latest!.status);
  });

  it('should count tasks by status', async () => {
    const counts = await countTasksByStatus(testProjectId);

    expect(counts[TaskStatus.SUCCESS]).toBeGreaterThanOrEqual(1);
    expect(counts[TaskStatus.FAILED]).toBeGreaterThanOrEqual(1);
    expect(counts[TaskStatus.PENDING]).toBeGreaterThanOrEqual(1);
    expect(counts[TaskStatus.PROCESSING]).toBe(0);
  });
});

describe('Task Events', () => {
  it('should create a task event', () => {
    const task = {
      id: 'test-task-123',
      projectId: 1,
      status: TaskStatus.PROCESSING as TaskStatus,
      executionLog: 'Processing...',
      errorMessage: null,
      startedAt: new Date(),
      completedAt: null,
      createdAt: new Date(),
      outputDir: null,
      outputFiles: null,
      outputSize: null,
      downloadCount: null,
      publicToken: null,
      sseEvents: null,
    } as const;

    const event = createTaskEvent('started', task as any, { message: 'Task started' });

    expect(event.type).toBe('started');
    expect(event.taskId).toBe('test-task-123');
    expect(event.timestamp).toBeDefined();
    expect(event.data?.status).toBe(TaskStatus.PROCESSING);
    expect(event.data?.message).toBe('Task started');
  });

  it('should create completion event with log', () => {
    const task = {
      id: 'test-task-456',
      projectId: 1,
      status: TaskStatus.SUCCESS as TaskStatus,
      executionLog: 'Step 1 done\nStep 2 done\n',
      errorMessage: null,
      startedAt: new Date(),
      completedAt: new Date(),
      createdAt: new Date(),
      outputDir: null,
      outputFiles: null,
      outputSize: null,
      downloadCount: null,
      publicToken: null,
      sseEvents: null,
    } as const;

    const event = createTaskEvent('completed', task as any);

    expect(event.type).toBe('completed');
    expect(event.data?.executionLog).toContain('Step 1 done');
  });
});
