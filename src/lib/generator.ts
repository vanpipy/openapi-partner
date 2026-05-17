/**
 * OpenAPI Type Generator
 * Handles async type generation with SSE progress updates
 * Uses swagger-typescript-api for modular TypeScript type generation
 * 
 * Generated files are stored in task-specific directories:
 *   {outputPath}/tasks/{taskId}/
 *     ├── manifest.json
 *     ├── data-contracts.ts
 *     ├── routes.ts (or route-types.ts)
 *     └── http-client.ts (if modular mode)
 */

import { spawn } from 'child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { getProject, updateProject } from '@/app/actions/project';
import { startProjectTask, completeProjectTask, failProjectTask, addProjectTaskLog } from '@/app/actions/tasks';
import { SpecType, type GeneratorOptions, DEFAULT_GENERATOR_OPTIONS } from './db/schema';
import { getDb } from './db';
import { eq } from 'drizzle-orm';
import { tasks, projects } from './db/schema';
import { createLogger } from './logger';

const logger = createLogger('Generator');

// Types for spec detection
interface SpecInfo {
  specType: typeof SpecType[keyof typeof SpecType];
  specVersion: string;
  wasConverted: boolean;
}

// Generated file info for manifest
interface GeneratedFile {
  name: string;
  path: string;
  size: number;
}

// ============================================
// Public API
// ============================================

export interface GenerateOptions {
  projectId: number;
  taskId: string;
  onProgress?: (message: string) => void;
  onComplete?: (outputPath: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Generate TypeScript types from OpenAPI/Swagger spec
 */
export async function generateTypes(options: GenerateOptions): Promise<{
  success: boolean;
  outputPath?: string;
  outputFiles?: GeneratedFile[];
  outputSize?: number;
  error?: string;
}> {
  const { projectId, taskId, onProgress, onComplete, onError } = options;

  logger.info({ projectId, taskId }, 'Starting type generation');

  try {
    // Get project details
    const project = await getProject(projectId);

    if (!project) {
      logger.error({ projectId, taskId }, 'Project not found');
      throw new Error('Project not found');
    }

    logger.info({ projectId, taskId, name: project.name, specUrl: project.specUrl }, 'Project found');

    // Mark task as processing
    await startProjectTask(taskId, projectId);
    logger.info({ taskId, projectId }, 'Task marked as processing');

    await addProjectTaskLog(taskId, projectId, `Starting type generation for: ${project.name}`);
    onProgress?.(`Fetching OpenAPI spec from: ${project.specUrl}`);
    logger.debug({ taskId, specUrl: project.specUrl }, 'Fetching spec');

    // Parse generator options from project
    const generatorOptions = parseGeneratorOptions(project.generatorOptions);

    // Create task-specific output directory
    const baseOutputDir = project.outputPath || './generated';
    const taskOutputDir = join(baseOutputDir, 'tasks', taskId);

    if (!existsSync(taskOutputDir)) {
      mkdirSync(taskOutputDir, { recursive: true });
    }

    // Detect spec version if auto-detect is enabled
    let specInfo: SpecInfo = {
      specType: project.specType,
      specVersion: project.specVersion || 'unknown',
      wasConverted: project.wasConvertedFromSwagger2 || false,
    };

    if (project.specType === SpecType.AUTO_DETECT) {
      onProgress?.('Detecting OpenAPI spec version...');
      specInfo = await detectSpecVersion(project.specUrl);
      onProgress?.(`Detected: ${specInfo.wasConverted ? 'Swagger 2.0 (will convert)' : 'OpenAPI ' + specInfo.specVersion}`);
    }

    // Run swagger-typescript-api
    const result = await runSwaggerTypescriptApi({
      specUrl: project.specUrl,
      outputDir: taskOutputDir,
      baseUrl: project.baseUrl || undefined,
      options: generatorOptions,
      onProgress: (message) => {
        onProgress?.(message);
        addProjectTaskLog(taskId, projectId, message).catch(console.error);
      },
    });

    if (result.success) {
      // Collect generated files info
      const outputFiles = collectGeneratedFiles(taskOutputDir);
      const outputSize = outputFiles.reduce((sum, f) => sum + f.size, 0);

      // Create manifest
      const manifest = {
        taskId,
        projectId,
        projectName: project.name,
        specUrl: project.specUrl,
        specVersion: specInfo.specVersion,
        wasConverted: specInfo.wasConverted,
        generatedAt: new Date().toISOString(),
        generatorOptions,
        files: outputFiles.map(f => ({ name: f.name, size: f.size })),
      };

      writeFileSync(
        join(taskOutputDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
      );

      // Add manifest to output files
      outputFiles.push({
        name: 'manifest.json',
        path: join(taskOutputDir, 'manifest.json'),
        size: statSync(join(taskOutputDir, 'manifest.json')).size,
      });

      // Generate public token
      const publicToken = randomUUID();

      // Update project with detected spec info if auto-detect was used
      if (project.specType === SpecType.AUTO_DETECT) {
        logger.info({ projectId, taskId, specType: specInfo.specType, specVersion: specInfo.specVersion }, 'Updating project with detected spec info');
        
        const updateResult = await updateProject({
          id: projectId,
          specType: specInfo.specType,
        });
        
        if (!updateResult.success) {
          logger.error({ projectId, taskId, error: updateResult.error }, 'Failed to update project spec type');
        } else {
          logger.info({ projectId, taskId }, 'Project spec type updated successfully');
        }

        // Update spec version in database directly
        const db = getDb();
        await db.update(projects)
          .set({
            specVersion: specInfo.specVersion,
            wasConvertedFromSwagger2: specInfo.wasConverted,
          })
          .where(eq(projects.id, projectId))
          .catch((e) => logger.error({ projectId, taskId, error: String(e) }, 'Failed to update project spec version'));
        
        logger.info({ projectId, taskId, specVersion: specInfo.specVersion, wasConverted: specInfo.wasConverted }, 'Project spec version updated');
      }

      // Update task with output info
      const db = getDb();
      await db.update(tasks)
        .set({
          outputDir: taskOutputDir,
          outputFiles: JSON.stringify(outputFiles.map(f => f.name)),
          outputSize,
          publicToken,
        })
        .where(eq(tasks.id, taskId))
        .catch(console.error);

      await completeProjectTask(taskId, projectId, result.logs);
      onComplete?.(taskOutputDir);
      return { success: true, outputPath: taskOutputDir, outputFiles, outputSize };
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error({ projectId, taskId, error: errorMessage, stack: error instanceof Error ? error.stack : undefined }, 'Type generation failed');

    await failProjectTask(taskId, projectId, errorMessage);
    onError?.(error instanceof Error ? error : new Error(errorMessage));

    return { success: false, error: errorMessage };
  }
}

// ============================================
// Generator Options Parsing
// ============================================

export function parseGeneratorOptions(optionsJson: string | null): GeneratorOptions {
  if (!optionsJson) {
    return DEFAULT_GENERATOR_OPTIONS;
  }

  try {
    const parsed = JSON.parse(optionsJson);
    return { ...DEFAULT_GENERATOR_OPTIONS, ...parsed };
  } catch {
    logger.warn('Failed to parse generator options, using defaults');
    return DEFAULT_GENERATOR_OPTIONS;
  }
}

// ============================================
// Spec Version Detection
// ============================================

/**
 * Detect OpenAPI spec version from URL
 */
async function detectSpecVersion(specUrl: string): Promise<SpecInfo> {
  logger.info({ specUrl }, 'Detecting spec version');

  try {
    const response = await fetch(specUrl, {
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      logger.error({ specUrl, status: response.status }, 'Failed to fetch spec');
      throw new Error(`Failed to fetch spec: ${response.status}`);
    }

    logger.debug({ specUrl, size: response.headers.get('content-length') }, 'Spec fetched successfully');

    const spec = await response.json();

    // Check for 'openapi' field (OpenAPI 3.x)
    if (spec.openapi) {
      const version = spec.openapi.toString();
      logger.info({ specUrl, version }, 'Detected OpenAPI spec');
      return {
        specType: SpecType.OPENAPI_3X,
        specVersion: version,
        wasConverted: false,
      };
    }

    // Check for 'swagger' field (Swagger 2.0)
    if (spec.swagger === '2.0') {
      logger.info({ specUrl }, 'Detected Swagger 2.0 spec (will convert)');
      return {
        specType: SpecType.SWAGGER_2X,
        specVersion: '2.0',
        wasConverted: true,
      };
    }

    // Fallback: assume OpenAPI 3.0
    return {
      specType: SpecType.OPENAPI_3X,
      specVersion: '3.0.0',
      wasConverted: false,
    };
  } catch (error) {
    console.error('Spec detection failed:', error);
    return {
      specType: SpecType.AUTO_DETECT,
      specVersion: 'unknown',
      wasConverted: false,
    };
  }
}

// ============================================
// swagger-typescript-api Integration
// ============================================

interface SwaggerApiOptions {
  specUrl: string;
  outputDir: string;
  baseUrl?: string;
  options: GeneratorOptions;
  onProgress?: (message: string) => void;
}

async function runSwaggerTypescriptApi(options: SwaggerApiOptions): Promise<{
  success: boolean;
  logs?: string;
  error?: string;
}> {
  const { specUrl, outputDir, baseUrl, options: genOptions, onProgress } = options;

  logger.info({ specUrl, outputDir }, 'Running swagger-typescript-api');

  return new Promise((resolve) => {
    const logs: string[] = [];

    // Build command arguments for swagger-typescript-api
    const args: string[] = ['generate'];

    // Input spec
    args.push('-p', specUrl);

    // Output directory
    args.push('-o', outputDir);

    // Base URL for API
    if (baseUrl) {
      args.push('--base-url', baseUrl);
    }

    // Modular output - separated files
    if (genOptions.modular) {
      args.push('--modular');
    }

    // Types only - no client
    if (genOptions.typesOnly) {
      args.push('--no-client');
    }

    // Route types
    if (genOptions.routeTypes) {
      args.push('--route-types');
    }

    // Extract enums
    if (genOptions.extractEnums) {
      args.push('--extract-enums');
    }

    // Extract responses
    if (genOptions.extractResponses) {
      args.push('--extract-responses');
    }

    // Extract request body
    if (genOptions.extractRequestBody) {
      args.push('--extract-request-body');
    }

    // Extract request params
    if (genOptions.extractRequestParams) {
      args.push('--extract-request-params');
    }

    // Extract response error
    if (genOptions.extractResponseError) {
      args.push('--extract-response-error');
    }

    // Readonly properties
    if (genOptions.readonly) {
      args.push('--add-readonly');
    }

    // Union enums
    if (genOptions.unionEnums) {
      args.push('--generate-union-enums');
    }

    // Sort types
    if (genOptions.sortTypes) {
      args.push('--sort-types');
    }

    // Sort routes
    if (genOptions.sortRoutes) {
      args.push('--sort-routes');
    }

    logger.debug({ args }, 'swagger-typescript-api arguments');

    // Use the CLI directly from node_modules to avoid npx picking up wrong package
    const cliPath = join(process.cwd(), 'node_modules', 'swagger-typescript-api', 'dist', 'cli.mjs');

    // Spawn the process - use node with the CLI directly
    const proc = spawn('node', [cliPath, ...args], {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
    });

    proc.stdout?.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        logs.push(message);
        onProgress?.(message);
      }
    });

    proc.stderr?.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        logs.push(`[stderr] ${message}`);
        onProgress?.(message);
      }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        logger.info('swagger-typescript-api completed successfully');
        resolve({ success: true, logs: logs.join('\n') });
      } else {
        const errorMsg = logs.join('\n') || `Process exited with code ${code}`;
        logger.error({ code, logs }, 'swagger-typescript-api failed');
        resolve({ success: false, error: errorMsg, logs: logs.join('\n') });
      }
    });

    proc.on('error', (err) => {
      logger.error({ error: err.message }, 'Failed to spawn swagger-typescript-api');
      resolve({ success: false, error: err.message });
    });
  });
}

// ============================================
// File Collection
// ============================================

/**
 * Recursively collect all generated files in a directory
 */
function collectGeneratedFiles(dir: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectGeneratedFiles(fullPath));
    } else if (entry.isFile()) {
      const stats = statSync(fullPath);
      // Skip manifest during collection (added separately)
      if (entry.name !== 'manifest.json' && entry.name.endsWith('.ts')) {
        files.push({
          name: entry.name,
          path: fullPath,
          size: stats.size,
        });
      }
    }
  }

  return files;
}

// ============================================
// Generator Queue (for background processing)
// ============================================

class GeneratorQueue {
  private queue: Array<{
    projectId: number;
    taskId: string;
  }> = [];
  private processing = false;

  async add(projectId: number, taskId: string): Promise<void> {
    this.queue.push({ projectId, taskId });
    this.process();
  }

  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;

      try {
        await generateTypes({
          projectId: item.projectId,
          taskId: item.taskId,
          onProgress: (message) => {
            console.log(`[${item.taskId}] ${message}`);
          },
        });
      } catch (error) {
        console.error(`Generator error for task ${item.taskId}:`, error);
      }
    }

    this.processing = false;
  }
}

// Singleton queue instance
export const generatorQueue = new GeneratorQueue();
