/**
 * Project Server Actions
 * Handles CRUD operations for projects
 */

'use server';

import { revalidatePath } from 'next/cache';
import { eq, desc } from 'drizzle-orm';
import { getDb, projects, type Project, type NewProject } from '@/lib/db';
import { createTask } from '@/lib/tasks';
import { listTokens } from '@/lib/auth';

// ============================================
// Project CRUD
// ============================================

export interface CreateProjectInput {
  name: string;
  swaggerUrl: string;
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
  swaggerUrl?: string;
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
        swaggerUrl: input.swaggerUrl,
        outputPath: input.outputPath ?? './generated',
        apiVersion: input.apiVersion ?? null,
        baseUrl: input.baseUrl ?? null,
        customTemplates: input.customTemplates ?? null,
        clientOptions: input.clientOptions ?? null,
        createdBy: input.createdBy ?? null,
      })
      .returning();

    revalidatePath('/projects');

    return { success: true, project };
  } catch (error) {
    console.error('Failed to create project:', error);
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
    if (input.swaggerUrl !== undefined) updateData.swaggerUrl = input.swaggerUrl;
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

    revalidatePath('/projects');

    return { success: true, project };
  } catch (error) {
    console.error('Failed to update project:', error);
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

    revalidatePath('/projects');

    return { success: true };
  } catch (error) {
    console.error('Failed to delete project:', error);
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
  const project = await getProject(projectId);

  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  if (!project.isActive) {
    return { success: false, error: 'Project is not active' };
  }

  const result = await createTask({ projectId });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath('/projects');

  return { success: true, taskId: result.task.id };
}
