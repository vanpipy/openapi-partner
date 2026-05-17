/**
 * Project Server Actions
 * Handles CRUD operations for projects
 */

'use server';

import { revalidatePath } from 'next/cache';
import { eq, desc } from 'drizzle-orm';
import { getDb, projects, type Project, type NewProject, SpecType, type GeneratorOptions, DEFAULT_GENERATOR_OPTIONS } from '@/lib/db';
import { createTask } from '@/lib/tasks';
import { listTokens } from '@/lib/auth';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ProjectActions');

// Safe logging helper - avoid logger crashes in async tasks
function safeLog(level: 'info' | 'warn' | 'error' | 'debug', message: string, obj?: object) {
  try {
    if (obj) {
      // Call logger methods directly
      if (level === 'info') logger.info(obj, message);
      else if (level === 'warn') logger.warn(obj, message);
      else if (level === 'error') logger.error(obj, message);
      else if (level === 'debug') logger.debug(obj, message);
    } else {
      if (level === 'info') logger.info(message);
      else if (level === 'warn') logger.warn(message);
      else if (level === 'error') logger.error(message);
      else if (level === 'debug') logger.debug(message);
    }
  } catch {
    // Silently ignore logging errors
  }
}

// ============================================
// Project CRUD
// ============================================

export interface CreateProjectInput {
  name: string;
  specUrl: string;
  specType?: typeof SpecType[keyof typeof SpecType];
  outputPath?: string;
  apiVersion?: string;
  baseUrl?: string;
  customTemplates?: string;
  generatorOptions?: GeneratorOptions;
  createdBy?: string;
}

export interface UpdateProjectInput {
  id: number;
  name?: string;
  specUrl?: string;
  specType?: typeof SpecType[keyof typeof SpecType];
  outputPath?: string;
  apiVersion?: string;
  baseUrl?: string;
  customTemplates?: string;
  generatorOptions?: GeneratorOptions;
  isActive?: boolean;
}

/**
 * Create a new project
 */
export async function createProject(input: CreateProjectInput): Promise<{
  success: true;
  project: Project;
} | {
  success: false;
  error: string;
}> {
  try {
    const db = getDb();

    const [project] = await db
      .insert(projects)
      .values({
        name: input.name,
        specUrl: input.specUrl,
        outputPath: input.outputPath ?? './generated',
        apiVersion: input.apiVersion ?? null,
        baseUrl: input.baseUrl ?? null,
        customTemplates: input.customTemplates ?? null,
        generatorOptions: input.generatorOptions ? JSON.stringify(input.generatorOptions) : JSON.stringify(DEFAULT_GENERATOR_OPTIONS),
        createdBy: input.createdBy ?? null,
      })
      .returning();

    safeLog('info', 'Project created', { projectId: project.id, name: project.name });
    revalidatePath('/projects');

    return { success: true, project };
  } catch (error) {
    safeLog('error', 'Failed to create project', { err: error, name: input.name });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create project',
    };
  }
}

/**
 * Update an existing project
 */
export async function updateProject(input: UpdateProjectInput): Promise<{
  success: true;
  project: Project;
} | {
  success: false;
  error: string;
}> {
  safeLog('debug', 'updateProject called', { projectId: input.id, updates: Object.keys(input).filter(k => k !== 'id') });
  try {
    const db = getDb();

    const updateData: Partial<NewProject> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.specUrl !== undefined) updateData.specUrl = input.specUrl;
    if (input.specType !== undefined) updateData.specType = input.specType;
    if (input.outputPath !== undefined) updateData.outputPath = input.outputPath;
    if (input.apiVersion !== undefined) updateData.apiVersion = input.apiVersion;
    if (input.baseUrl !== undefined) updateData.baseUrl = input.baseUrl;
    if (input.customTemplates !== undefined) updateData.customTemplates = input.customTemplates;
    if (input.generatorOptions !== undefined) updateData.generatorOptions = JSON.stringify(input.generatorOptions);
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    const [project] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, input.id))
      .returning();

    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    safeLog('info', 'Project updated', { projectId: project.id });

    return { success: true, project };
  } catch (error) {
    safeLog('error', 'Failed to update project', { err: error, projectId: input.id });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update project',
    };
  }
}

/**
 * Delete a project
 */
export async function deleteProject(id: number): Promise<{
  success: true;
} | {
  success: false;
  error: string;
}> {
  try {
    const db = getDb();

    await db.delete(projects).where(eq(projects.id, id));

    safeLog('info', 'Project deleted', { projectId: id });
    revalidatePath('/projects');

    return { success: true };
  } catch (error) {
    safeLog('error', 'Failed to delete project', { err: error, projectId: id });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete project',
    };
  }
}

/**
 * Get a project by ID
 */
export async function getProject(id: number): Promise<Project | null> {
  const db = getDb();

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .get();

  return project ?? null;
}

/**
 * List all projects
 */
export async function listProjects(options?: {
  limit?: number;
  isActive?: boolean;
}): Promise<Project[]> {
  try {
    const db = getDb();

    let query = db.select().from(projects);

    if (options?.isActive !== undefined) {
      query = query.where(eq(projects.isActive, options.isActive)) as typeof query;
    }

    query = query.orderBy(desc(projects.createdAt)) as typeof query;

    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }

    return query.all();
  } catch (error) {
    safeLog('error', 'Failed to list projects', { err: error });
    throw error;
  }
}

// ============================================
// Project with Details
// ============================================

export interface ProjectWithDetails extends Project {
  tokenCount: number;
  latestTask?: {
    id: string;
    status: string;
    createdAt: Date;
  };
}

/**
 * Get project with additional details
 */
export async function getProjectWithDetails(id: number): Promise<ProjectWithDetails | null> {
  const db = getDb();

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .get();

  if (!project) return null;

  // Get token count
  const tokens = await listTokens(id);

  // Get latest task
  const { getLatestTask } = await import('@/lib/tasks');
  const latestTask = await getLatestTask(id);

  return {
    ...project,
    tokenCount: tokens.length,
    latestTask: latestTask
      ? {
          id: latestTask.id,
          status: latestTask.status,
          createdAt: latestTask.createdAt,
        }
      : undefined,
  };
}

/**
 * Trigger a sync task for a project (idempotent)
 * Returns existing task if one is already pending or processing
 */
export async function triggerProjectSync(
  projectId: number
): Promise<{
  success: true;
  taskId: string;
  isExisting: boolean;
} | {
  success: false;
  error: string;
}> {
  safeLog('info', 'Sync triggered', { projectId });

  const project = await getProject(projectId);

  if (!project) {
    safeLog('warn', 'Project not found', { projectId });
    return { success: false, error: 'Project not found' };
  }

  if (!project.isActive) {
    safeLog('warn', 'Project is not active', { projectId });
    return { success: false, error: 'Project is not active' };
  }

  // Check for existing pending/processing task (idempotency)
  const { getPendingOrProcessingTask } = await import('@/lib/tasks');
  const existingTask = await getPendingOrProcessingTask(projectId);

  if (existingTask) {
    safeLog('info', 'Using existing task (idempotent)', { projectId, taskId: existingTask.id });
    return { success: true, taskId: existingTask.id, isExisting: true };
  }

  safeLog('info', 'Creating new task', { projectId, specUrl: project.specUrl });

  const result = await createTask({ projectId });

  if (!result.success) {
    safeLog('error', 'Failed to create task', { projectId, error: result.error });
    return { success: false, error: result.error };
  }

  const taskId = result.task.id;
  safeLog('info', 'Task created, starting processing', { taskId, projectId });

  // Start processing the task asynchronously
  processTask(taskId, projectId).catch((error) => {
    safeLog('error', 'Task processor crashed', { taskId, projectId, error: String(error) });
  });

  revalidatePath('/projects');

  return { success: true, taskId, isExisting: false };
}

/**
 * Broadcast SSE event to connected clients
 */
async function broadcastEvent(taskId: string, type: string, data?: Record<string, unknown>) {
  try {
    const { broadcastTaskEvent, getListenerCount, getTotalListenerCount } = await import('@/lib/events');
    const count = await broadcastTaskEvent(taskId, { type, ...data });
    const taskListeners = getListenerCount(taskId);
    const totalListeners = getTotalListenerCount();
    safeLog('debug', `SSE broadcast ${type} sent to ${count}/${taskListeners} task listeners (${totalListeners} total)`, { taskId, count, taskListeners, totalListeners });
  } catch (e) {
    safeLog('error', 'Failed to broadcast event', { taskId, error: String(e) });
  }
}

/**
 * Process a task asynchronously
 */
async function processTask(taskId: string, projectId: number) {
  safeLog('info', 'Starting task processing', { taskId, projectId });

  try {
    // Start the task
    const { startTask, failTask, appendTaskLog } = await import('@/lib/tasks');
    safeLog('debug', 'Calling startTask', { taskId, projectId });
    const startResult = await startTask(taskId);
    safeLog('debug', 'startTask result', { taskId, projectId, success: startResult.success });

    if (!startResult.success) {
      safeLog('error', 'Failed to start task', { taskId, projectId, error: startResult.error });
      return;
    }

    safeLog('info', 'Task started, beginning type generation', { taskId, projectId });

    // Broadcast started event
    await broadcastEvent(taskId, 'started', { status: 'PROCESSING' });

    // Log start
    await appendTaskLog(taskId, `[${new Date().toISOString()}] Starting type generation...`);

    // Import generator and run
    const { generateTypes } = await import('@/lib/generator');

    const result = await generateTypes({
      projectId,
      taskId,
      onProgress: async (message) => {
        try {
          safeLog('debug', 'Generation progress', { taskId, message });
          await appendTaskLog(taskId, message);
        } catch (e) {
          safeLog('error', 'Failed to log progress', { taskId, error: String(e) });
        }
      },
      onComplete: async (outputPath) => {
        safeLog('info', 'Task completed successfully', { taskId, projectId, outputPath });
      },
      onError: async (error) => {
        safeLog('error', 'Task generation error', { taskId, projectId, error: String(error) });
      },
    });

    if (result.success) {
      safeLog('info', 'Type generation completed', { 
        taskId, 
        projectId, 
        outputPath: result.outputPath,
        outputSize: result.outputSize,
        fileCount: result.outputFiles?.length 
      });
      await appendTaskLog(taskId, `[${new Date().toISOString()}] ✓ Type generation completed successfully!`);
      
      // Broadcast completed event
      await broadcastEvent(taskId, 'completed', { 
        status: 'SUCCESS',
        outputPath: result.outputPath,
        outputSize: result.outputSize,
        outputFiles: result.outputFiles
      });
    } else {
      safeLog('error', 'Type generation failed', { taskId, projectId, error: result.error });
      await failTask(taskId, result.error || 'Unknown error');
      
      // Broadcast failed event
      await broadcastEvent(taskId, 'failed', { 
        status: 'FAILED',
        errorMessage: result.error
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    safeLog('error', 'Task processing failed', { taskId, projectId, error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
    
    try {
      const { failTask } = await import('@/lib/tasks');
      await failTask(taskId, errorMessage);
      safeLog('info', 'Task marked as failed', { taskId, projectId });
      
      // Broadcast failed event
      await broadcastEvent(taskId, 'failed', { status: 'FAILED', errorMessage });
    } catch (e) {
      // Ignore errors in error handling
    }
  }
}
