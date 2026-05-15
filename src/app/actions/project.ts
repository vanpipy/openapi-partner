/**
 * Project Server Actions
 * Handles CRUD operations for projects
 */

'use server';

import { revalidatePath } from 'next/cache';
import { eq, desc } from 'drizzle-orm';
import { getDb, projects, type Project, type NewProject, SpecType } from '@/lib/db';
import { createTask } from '@/lib/tasks';
import { listTokens } from '@/lib/auth';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ProjectActions');

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
  clientOptions?: string;
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
  clientOptions?: string;
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
        clientOptions: input.clientOptions ?? null,
        createdBy: input.createdBy ?? null,
      })
      .returning();

    logger.info({ projectId: project.id, name: project.name }, 'Project created');
    revalidatePath('/projects');

    return { success: true, project };
  } catch (error) {
    logger.error({ err: error, name: input.name }, 'Failed to create project');
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
    if (input.clientOptions !== undefined) updateData.clientOptions = input.clientOptions;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    const [project] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, input.id))
      .returning();

    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    logger.info({ projectId: project.id }, 'Project updated');
    revalidatePath('/projects');

    return { success: true, project };
  } catch (error) {
    logger.error({ err: error, projectId: input.id }, 'Failed to update project');
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

    logger.info({ projectId: id }, 'Project deleted');
    revalidatePath('/projects');

    return { success: true };
  } catch (error) {
    logger.error({ err: error, projectId: id }, 'Failed to delete project');
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
 * Trigger a sync task for a project
 */
export async function triggerProjectSync(
  projectId: number
): Promise<{
  success: true;
  taskId: string;
} | {
  success: false;
  error: string;
}> {
  logger.info({ projectId }, 'Sync triggered');

  const project = await getProject(projectId);

  if (!project) {
    logger.warn({ projectId }, 'Project not found');
    return { success: false, error: 'Project not found' };
  }

  if (!project.isActive) {
    logger.warn({ projectId }, 'Project is not active');
    return { success: false, error: 'Project is not active' };
  }

  logger.info({ projectId, specUrl: project.specUrl }, 'Creating task');

  const result = await createTask({ projectId });

  if (!result.success) {
    logger.error({ projectId, error: result.error }, 'Failed to create task');
    return { success: false, error: result.error };
  }

  const taskId = result.task.id;
  logger.info({ taskId, projectId }, 'Task created, starting processing');

  // Start processing the task asynchronously
  processTask(taskId, projectId).catch((error) => {
    logger.error({ taskId, projectId, error }, 'Task processor crashed');
  });

  revalidatePath('/projects');

  return { success: true, taskId };
}

/**
 * Process a task asynchronously
 */
async function processTask(taskId: string, projectId: number) {
  logger.info({ taskId, projectId }, 'Starting task processing');

  try {
    // Start the task
    const { startTask, completeTask, failTask, appendTaskLog } = await import('@/lib/tasks');
    const startResult = await startTask(taskId);

    if (!startResult.success) {
      logger.error({ taskId, projectId, error: startResult.error }, 'Failed to start task');
      return;
    }

    logger.info({ taskId, projectId }, 'Task started, beginning type generation');

    // Log start
    await appendTaskLog(taskId, `[${new Date().toISOString()}] Starting type generation...`);

    // Import generator and run
    const { generateTypes } = await import('@/lib/generator');

    const result = await generateTypes({
      projectId,
      taskId,
      onProgress: async (message) => {
        try {
          logger.debug({ taskId, message }, 'Generation progress');
          await appendTaskLog(taskId, message);
        } catch (e) {
          logger.error({ taskId, error: e }, 'Failed to log progress');
        }
      },
      onComplete: async (outputPath) => {
        logger.info({ taskId, projectId, outputPath }, 'Task completed successfully');
      },
      onError: async (error) => {
        logger.error({ taskId, projectId, error: String(error) }, 'Task generation error');
      },
    });

    if (result.success) {
      logger.info({ 
        taskId, 
        projectId, 
        outputPath: result.outputPath,
        outputSize: result.outputSize,
        fileCount: result.outputFiles?.length 
      }, 'Type generation completed');
      await appendTaskLog(taskId, `[${new Date().toISOString()}] ✓ Type generation completed successfully!`);
    } else {
      logger.error({ taskId, projectId, error: result.error }, 'Type generation failed');
      await failTask(taskId, result.error || 'Unknown error');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ taskId, projectId, error: errorMessage, stack: error instanceof Error ? error.stack : undefined }, 'Task processing failed');
    
    try {
      const { failTask } = await import('@/lib/tasks');
      await failTask(taskId, errorMessage);
      logger.info({ taskId, projectId }, 'Task marked as failed');
    } catch (e) {
      logger.error({ taskId, error: e }, 'Failed to mark task as failed');
    }
  }
}
