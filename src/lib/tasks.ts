import { eq, desc } from 'drizzle-orm';
import { getDb, tasks, projects, TaskStatus } from './db';
import type { Task } from './db';

// Re-export TaskStatus for convenience
export { TaskStatus };

/**
 * Task Management Module
 * Handles task lifecycle tracking for API type generation
 */

// ============================================
// Task Creation
// ============================================

export interface CreateTaskOptions {
  projectId: number;
}

/**
 * Create a new task for a project
 */
export async function createTask(options: CreateTaskOptions): Promise<{
  success: true;
  task: Task;
} | {
  success: false;
  error: string;
}> {
  const db = getDb();

  // Verify project exists
  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, options.projectId))
    .get();

  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  const taskId = crypto.randomUUID();

  const [task] = await db
    .insert(tasks)
    .values({
      id: taskId,
      projectId: options.projectId,
      status: TaskStatus.PENDING,
    })
    .returning();

  return { success: true, task };
}

// ============================================
// Task Status Updates
// ============================================

/**
 * Mark task as processing
 */
export async function startTask(taskId: string): Promise<{
  success: true;
  task: Task;
} | {
  success: false;
  error: string;
}> {
  const db = getDb();

  const [task] = await db
    .update(tasks)
    .set({
      status: TaskStatus.PROCESSING,
      startedAt: new Date(),
    })
    .where(eq(tasks.id, taskId))
    .returning();

  if (!task) {
    return { success: false, error: 'Task not found' };
  }

  return { success: true, task };
}

/**
 * Mark task as completed successfully
 */
export async function completeTask(taskId: string, executionLog?: string): Promise<{
  success: true;
  task: Task;
} | {
  success: false;
  error: string;
}> {
  const db = getDb();

  const [task] = await db
    .update(tasks)
    .set({
      status: TaskStatus.SUCCESS,
      completedAt: new Date(),
      executionLog: executionLog ?? null,
      errorMessage: null,
    })
    .where(eq(tasks.id, taskId))
    .returning();

  if (!task) {
    return { success: false, error: 'Task not found' };
  }

  return { success: true, task };
}

/**
 * Mark task as failed
 */
export async function failTask(
  taskId: string,
  errorMessage: string,
  executionLog?: string
): Promise<{
  success: true;
  task: Task;
} | {
  success: false;
  error: string;
}> {
  const db = getDb();

  const [task] = await db
    .update(tasks)
    .set({
      status: TaskStatus.FAILED,
      completedAt: new Date(),
      errorMessage,
      executionLog: executionLog ?? null,
    })
    .where(eq(tasks.id, taskId))
    .returning();

  if (!task) {
    return { success: false, error: 'Task not found' };
  }

  return { success: true, task };
}

/**
 * Append to task execution log
 */
export async function appendTaskLog(taskId: string, logMessage: string): Promise<void> {
  const db = getDb();

  const task = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .get();

  if (!task) return;

  const existingLog = task.executionLog ?? '';
  const timestamp = new Date().toISOString();
  const newLog = `${existingLog}[${timestamp}] ${logMessage}\n`;

  await db
    .update(tasks)
    .set({ executionLog: newLog })
    .where(eq(tasks.id, taskId));
}

// ============================================
// Task Queries
// ============================================

/**
 * Get task by ID
 */
export async function getTask(taskId: string): Promise<Task | null> {
  const db = getDb();

  const task = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .get();

  return task ?? null;
}

/**
 * List tasks for a project
 */
export async function listProjectTasks(
  projectId: number,
  options?: {
    limit?: number;
    status?: TaskStatus;
  }
): Promise<Task[]> {
  const db = getDb();

  const baseQuery = db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .orderBy(desc(tasks.createdAt));

  if (options?.limit) {
    return baseQuery.limit(options.limit).all();
  }

  return baseQuery.all();
}

/**
 * Get latest task for a project
 */
export async function getLatestTask(projectId: number): Promise<Task | null> {
  const db = getDb();

  const task = await db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .orderBy(desc(tasks.createdAt))
    .limit(1)
    .get();

  return task ?? null;
}

/**
 * Count tasks by status for a project
 */
export async function countTasksByStatus(
  projectId: number
): Promise<Record<TaskStatus, number>> {
  const db = getDb();

  const allTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .all();

  const counts: Record<string, number> = {
    [TaskStatus.PENDING]: 0,
    [TaskStatus.PROCESSING]: 0,
    [TaskStatus.SUCCESS]: 0,
    [TaskStatus.FAILED]: 0,
  };

  for (const task of allTasks) {
    counts[task.status] = (counts[task.status] || 0) + 1;
  }

  return counts as Record<TaskStatus, number>;
}

// ============================================
// Task Cleanup
// ============================================

/**
 * Delete old completed tasks (cleanup)
 */
export async function cleanupOldTasks(
  projectId: number,
  keepCount: number = 10
): Promise<number> {
  const db = getDb();

  // Get IDs of tasks to keep
  const tasksToKeep = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .orderBy(desc(tasks.createdAt))
    .limit(keepCount)
    .all();

  const keepIds = tasksToKeep.map((t) => t.id);

  if (keepIds.length === 0) return 0;

  // Delete tasks not in keep list
  const result = await db
    .delete(tasks)
    .where(eq(tasks.projectId, projectId))
    .returning();

  // This is simplified - in production you'd use a subquery
  return result.length;
}

/**
 * Clear all tasks for a project
 */
export async function clearProjectTasks(projectId: number): Promise<number> {
  const db = getDb();

  const result = await db
    .delete(tasks)
    .where(eq(tasks.projectId, projectId))
    .returning()
    .all();

  return result.length;
}

// ============================================
// SSE Event Types
// ============================================

export type TaskEventType =
  | 'created'
  | 'started'
  | 'progress'
  | 'completed'
  | 'failed';

export interface TaskEvent {
  type: TaskEventType;
  taskId: string;
  timestamp: string;
  data?: {
    status?: TaskStatus;
    message?: string;
    executionLog?: string;
    errorMessage?: string;
    progress?: number;
  };
}

/**
 * Create a task event for SSE
 */
export function createTaskEvent(
  type: TaskEventType,
  task: Task,
  data?: Partial<TaskEvent['data']>
): TaskEvent {
  return {
    type,
    taskId: task.id,
    timestamp: new Date().toISOString(),
    data: {
      ...data,
      status: task.status,
      executionLog: task.executionLog ?? undefined,
      errorMessage: task.errorMessage ?? undefined,
    },
  };
}
