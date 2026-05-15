/**
 * Task Server Actions
 * Handles task operations and status updates
 */

'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { getDb, tasks, projects } from '@/lib/db';
import {
  getTask,
  listProjectTasks,
  startTask,
  completeTask,
  failTask,
  appendTaskLog,
  countTasksByStatus,
  type TaskEvent,
} from '@/lib/tasks';
import { TaskStatus } from '@/lib/db';
import type { Task } from '@/lib/db';

// ============================================
// Task Queries
// ============================================

export interface TaskListItem {
  id: string;
  status: string;
  errorMessage: string | null;
  executionLog: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

/**
 * Get tasks for a project
 */
export async function getProjectTasks(
  projectId: number,
  options?: {
    limit?: number;
    status?: TaskStatus;
  }
): Promise<TaskListItem[]> {
  const taskList = await listProjectTasks(projectId, options);

  return taskList.map((task) => ({
    id: task.id,
    status: task.status,
    errorMessage: task.errorMessage,
    executionLog: task.executionLog,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    createdAt: task.createdAt,
  }));
}

/**
 * Get a single task by ID
 */
export async function getProjectTask(
  taskId: string
): Promise<Task | null> {
  return getTask(taskId);
}

/**
 * Get task statistics for a project
 */
export async function getProjectTaskStats(projectId: number): Promise<{
  total: number;
  pending: number;
  processing: number;
  success: number;
  failed: number;
}> {
  const counts = await countTasksByStatus(projectId);

  const total =
    counts[TaskStatus.PENDING] +
    counts[TaskStatus.PROCESSING] +
    counts[TaskStatus.SUCCESS] +
    counts[TaskStatus.FAILED];

  return {
    total,
    pending: counts[TaskStatus.PENDING],
    processing: counts[TaskStatus.PROCESSING],
    success: counts[TaskStatus.SUCCESS],
    failed: counts[TaskStatus.FAILED],
  };
}

// ============================================
// Task Lifecycle Actions
// ============================================

/**
 * Start processing a task
 */
export async function startProjectTask(
  taskId: string,
  projectId: number
): Promise<{
  success: true;
  task: Task;
} | {
  success: false;
  error: string;
}> {
  const result = await startTask(taskId);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath(`/projects/${projectId}/tasks`);

  return { success: true, task: result.task };
}

/**
 * Complete a task successfully
 */
export async function completeProjectTask(
  taskId: string,
  projectId: number,
  executionLog?: string
): Promise<{
  success: true;
  task: Task;
} | {
  success: false;
  error: string;
}> {
  const result = await completeTask(taskId, executionLog);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath(`/projects/${projectId}/tasks`);

  return { success: true, task: result.task };
}

/**
 * Mark a task as failed
 */
export async function failProjectTask(
  taskId: string,
  projectId: number,
  errorMessage: string,
  executionLog?: string
): Promise<{
  success: true;
  task: Task;
} | {
  success: false;
  error: string;
}> {
  const result = await failTask(taskId, errorMessage, executionLog);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath(`/projects/${projectId}/tasks`);

  return { success: true, task: result.task };
}

/**
 * Add a log message to a task
 */
export async function addProjectTaskLog(
  taskId: string,
  projectId: number,
  message: string
): Promise<{
  success: true;
} | {
  success: false;
  error: string;
}> {
  try {
    await appendTaskLog(taskId, message);

    revalidatePath(`/projects/${projectId}/tasks`);

    return { success: true };
  } catch (error) {
    console.error('Failed to add task log:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add log',
    };
  }
}

// ============================================
// SSE Support
// ============================================

/**
 * Create SSE event for task update
 */
export async function createTaskSseEvent(
  taskId: string,
  type: 'created' | 'started' | 'progress' | 'completed' | 'failed',
  data?: {
    message?: string;
    executionLog?: string;
    errorMessage?: string;
    progress?: number;
  }
): Promise<TaskEvent | null> {
  const task = await getTask(taskId);

  if (!task) return null;

  const { createTaskEvent: createEvent } = await import('@/lib/tasks');

  return createEvent(type, task, data);
}
