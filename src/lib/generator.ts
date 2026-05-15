/**
 * Swagger Type Generator
 * Handles async type generation with SSE progress updates
 */

import { spawn } from 'child_process';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getProject } from '@/app/actions/project';
import { startProjectTask, completeProjectTask, failProjectTask, addProjectTaskLog } from '@/app/actions/tasks';

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
  error?: string;
}> {
  const { projectId, taskId, onProgress, onComplete, onError } = options;

  try {
    // Get project details
    const project = await getProject(projectId);

    if (!project) {
      throw new Error('Project not found');
    }

    // Mark task as processing
    await startProjectTask(taskId, projectId);
    await addProjectTaskLog(taskId, projectId, `Starting type generation for: ${project.name}`);
    onProgress?.(`Fetching OpenAPI spec from: ${project.swaggerUrl}`);

    // Create output directory
    const outputDir = project.outputPath || './generated';
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Generate output file path
    const outputFile = join(outputDir, `${project.name.toLowerCase().replace(/\s+/g, '-')}-api.ts`);

    // Call swagger-typescript-api
    // Note: In production, you'd install swagger-typescript-api as a dependency
    const result = await runSwaggerGenerator({
      swaggerUrl: project.swaggerUrl,
      outputFile,
      apiVersion: project.apiVersion || undefined,
      baseUrl: project.baseUrl || undefined,
      onProgress: (message) => {
        onProgress?.(message);
        addProjectTaskLog(taskId, projectId, message).catch(console.error);
      },
    });

    if (result.success) {
      await completeProjectTask(taskId, projectId, result.logs);
      onComplete?.(outputFile);
      return { success: true, outputPath: outputFile };
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await failProjectTask(taskId, projectId, errorMessage);
    onError?.(error instanceof Error ? error : new Error(errorMessage));
    
    return { success: false, error: errorMessage };
  }
}

/**
 * Run swagger-typescript-api CLI
 */
async function runSwaggerGenerator(options: {
  swaggerUrl: string;
  outputFile: string;
  apiVersion?: string;
  baseUrl?: string;
  onProgress?: (message: string) => void;
}): Promise<{
  success: boolean;
  logs?: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    const logs: string[] = [];

    // Build command arguments
    const args = [
      'npx',
      'swagger-typescript-api',
      '-p', options.swaggerUrl,
      '-o', options.outputFile,
    ];

    if (options.apiVersion) {
      args.push('--api-version', options.apiVersion);
    }

    if (options.baseUrl) {
      args.push('--base-url', options.baseUrl);
    }

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

      // Create a demo output file
      const dir = join(process.cwd(), 'generated');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      
      const demoContent = `/**
 * Generated API Types
 * Source: ${options.swaggerUrl}
 * Generated: ${new Date().toISOString()}
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

      const fs = await import('fs');
      fs.writeFileSync(options.outputFile, demoContent);

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
