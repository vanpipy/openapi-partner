/**
 * OpenAPI Type Generator
 * Handles async type generation with SSE progress updates
 * Supports OpenAPI 3.x and Swagger 2.0 with auto-detection
 * 
 * Generated files are stored in task-specific directories:
 *   {outputPath}/tasks/{taskId}/
 *     ├── manifest.json
 *     ├── api.ts
 *     ├── data-contracts.ts
 *     └── ...
 */

import { spawn } from 'child_process';
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { getProject, updateProject } from '@/app/actions/project';
import { startProjectTask, completeProjectTask, failProjectTask, addProjectTaskLog } from '@/app/actions/tasks';
import { SpecType } from './db/schema';
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

interface GenerationResult {
  success: boolean;
  outputPath?: string;
  outputFiles?: GeneratedFile[];
  outputSize?: number;
  error?: string;
}

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
      // Skip manifest during collection, add it separately
      if (entry.name !== 'manifest.json') {
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

/**
 * Generator options
 */
export interface GeneratorOptions {
  projectId: number;
  taskId: string;
  onProgress?: (message: string) => void;
  onComplete?: (outputPath: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Generate TypeScript types from Swagger/OpenAPI spec
 */
export async function generateTypes(options: GeneratorOptions): Promise<{
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

    // Create task-specific output directory
    const baseOutputDir = project.outputPath || './generated';
    const taskOutputDir = join(baseOutputDir, 'tasks', taskId);
    
    if (!existsSync(taskOutputDir)) {
      mkdirSync(taskOutputDir, { recursive: true });
    }

    // Generate output file path
    const outputFile = join(taskOutputDir, 'api.ts');

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

    // Call swagger-typescript-api
    // Note: In production, you'd install swagger-typescript-api as a dependency
    const result = await runSwaggerGenerator({
      specUrl: project.specUrl,
      outputFile,
      apiVersion: project.apiVersion || undefined,
      baseUrl: project.baseUrl || undefined,
      specType: specInfo.specType,
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
        files: outputFiles.map(f => ({ name: f.name, size: f.size })),
      };
      
      // Write manifest
      const fs = await import('fs');
      fs.writeFileSync(
        join(taskOutputDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
      );
      outputFiles.push({
        name: 'manifest.json',
        path: join(taskOutputDir, 'manifest.json'),
        size: statSync(join(taskOutputDir, 'manifest.json')).size,
      });
      
      // Generate public token
      const publicToken = randomUUID();
      
      // Update project with detected spec info if auto-detect was used
      if (project.specType === SpecType.AUTO_DETECT) {
        await updateProject({
          id: projectId,
          specType: specInfo.specType,
        }).catch(console.error);
        
        // Update spec version in database directly
        const db = getDb();
        await db.update(projects)
          .set({ 
            specVersion: specInfo.specVersion,
            wasConvertedFromSwagger2: specInfo.wasConverted,
          })
          .where(eq(projects.id, projectId))
          .catch(console.error);
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

/**
 * Run swagger-typescript-api CLI
 */
/**
 * Detect OpenAPI spec version from URL
 * Fetches the spec and checks for 'openapi' vs 'swagger' field
 */
async function detectSpecVersion(specUrl: string): Promise<SpecInfo> {
  logger.info({ specUrl }, 'Detecting spec version');
  
  try {
    const response = await fetch(specUrl, { 
      signal: AbortSignal.timeout(10000) // 10 second timeout
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
    // Default to auto-detect mode, will be handled by swagger-typescript-api
    return {
      specType: SpecType.AUTO_DETECT,
      specVersion: 'unknown',
      wasConverted: false,
    };
  }
}

/**
 * Run swagger-typescript-api CLI
 */
async function runSwaggerGenerator(options: {
  specUrl: string;
  outputFile: string;
  apiVersion?: string;
  baseUrl?: string;
  specType?: typeof SpecType[keyof typeof SpecType];
  onProgress?: (message: string) => void;
}): Promise<{
  success: boolean;
  logs?: string;
  error?: string;
  specInfo?: SpecInfo;
}> {
  logger.info({ 
    specUrl: options.specUrl, 
    outputFile: options.outputFile 
  }, 'Running swagger-typescript-api');

  return new Promise((resolve) => {
    const logs: string[] = [];

    // Build command arguments
    const args = [
      'npx',
      'swagger-typescript-api',
      '-p', options.specUrl,
      '-o', options.outputFile,
    ];

    if (options.apiVersion) {
      args.push('--api-version', options.apiVersion);
    }

    if (options.baseUrl) {
      args.push('--base-url', options.baseUrl);
    }

    logger.debug({ args }, 'Command args');

    // For demo purposes, simulate the process
    // In production, uncomment the actual spawn
    /*
    const proc = spawn('npx', args.slice(1), {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.stdout?.on('data', (data) => {
      const message = data.toString().trim();
      logs.push(message);
      options.onProgress?.(message);
    });

    proc.stderr?.on('data', (data) => {
      const message = data.toString().trim();
      logs.push(`[ERROR] ${message}`);
      options.onProgress?.(`[ERROR] ${message}`);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, logs: logs.join('\n') });
      } else {
        resolve({ success: false, error: logs.join('\n'), logs: logs.join('\n') });
      }
    });
    */

    // Simulate for demo
    const simulateProgress = async () => {
      logger.info('Simulating type generation');
      
      const steps = [
        'Fetching OpenAPI specification...',
        'Parsing JSON schema...',
        'Extracting endpoints...',
        'Generating TypeScript types...',
        'Creating API client...',
        'Writing output files...',
        'Type generation complete!',
      ];

      for (const step of steps) {
        await new Promise((r) => setTimeout(r, 500));
        logs.push(step);
        options.onProgress?.(step);
      }

      // Create output files in the task directory
      const fs = await import('fs');
      const outputDir = join(options.outputFile, '..');
      
      // Create data-contracts.ts
      const dataContracts = `/**
 * Data Contracts
 * Type definitions for API requests and responses
 */

// Add your generated types here
export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  message?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
`;
      fs.writeFileSync(join(outputDir, 'data-contracts.ts'), dataContracts);
      
      // Create http-client.ts
      const httpClient = `/**
 * HTTP Client
 * Base HTTP configuration for API calls
 */

export interface HttpClientOptions {
  baseUrl: string;
  headers?: Record<string, string>;
}

export class HttpClient {
  constructor(private options: HttpClientOptions) {}
  
  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(\`\${this.options.baseUrl}\${path}\`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...this.options.headers,
        ...init?.headers,
      },
    });
    return response.json();
  }
}
`;
      fs.writeFileSync(join(outputDir, 'http-client.ts'), httpClient);
      
      // Create route-types.ts
      const routeTypes = `/**
 * Route Types
 * Type definitions for API endpoints
 */

export interface RouteDefinition {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
}
`;
      fs.writeFileSync(join(outputDir, 'route-types.ts'), routeTypes);
      
      // Create api.ts (main file)
      const apiContent = `/**
 * Generated API Client
 * Source: ${options.specUrl}
 * Generated: ${new Date().toISOString()}
 */

import { HttpClient } from './http-client';
import type * as Contracts from './data-contracts';

export { Contracts };

export interface ApiClientOptions {
  baseUrl: string;
  token?: string;
}

export class ApiClient extends HttpClient {
  constructor(options: ApiClientOptions) {
    super({
      baseUrl: options.baseUrl,
      headers: options.token ? { Authorization: \`Bearer \${options.token}\` } : {},
    });
  }
}
`;
      fs.writeFileSync(options.outputFile, apiContent);

      resolve({ success: true, logs: logs.join('\n') });
    };

    simulateProgress();
  });
}

/**
 * Queue for background processing
 */
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
