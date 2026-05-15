/**
 * Vite Plugin for OpenAPI Partner
 * Fetches and caches generated TypeScript types from openapi-partner platform
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, createReadStream } from 'fs';
import { join, dirname } from 'path';
import { createWriteStream } from 'fs';
import type { Plugin } from 'vite';

export interface OpenAPIPartnerOptions {
  /**
   * API base URL of the openapi-partner platform
   * @default 'http://localhost:3000'
   */
  apiUrl?: string;
  
  /**
   * Project ID to fetch types from (fetches latest successful task)
   */
  projectId?: number;
  
  /**
   * Specific task ID to fetch (for exact version)
   */
  taskId?: string;
  
  /**
   * Output directory for generated types
   * @default './src/api/generated'
   */
  outputDir?: string;
  
  /**
   * API token for authentication (if required)
   * Can also be set via OPENAPI_PARTNER_TOKEN env variable
   */
  apiToken?: string;
  
  /**
   * Cache TTL in milliseconds
   * @default 3600000 (1 hour)
   */
  cacheTtl?: number;
  
  /**
   * Whether to clear cache before fetching
   * @default false
   */
  clearCache?: boolean;
}

interface CachedManifest {
  taskId: string;
  files: { name: string; path: string }[];
  fetchedAt: number;
}

const DEFAULT_OPTIONS: Required<OpenAPIPartnerOptions> = {
  apiUrl: 'http://localhost:3000',
  projectId: undefined as never,
  taskId: undefined as never,
  outputDir: './src/api/generated',
  apiToken: undefined as never,
  cacheTtl: 3600000, // 1 hour
  clearCache: false,
};

/**
 * Fetches file from URL and saves to destination
 */
async function fetchAndSaveFile(url: string, destPath: string, token?: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  
  const dir = dirname(destPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  const buffer = await response.arrayBuffer();
  writeFileSync(destPath, Buffer.from(buffer));
}

/**
 * Main plugin function
 */
export function openapiPartner(userOptions: OpenAPIPartnerOptions = {}): Plugin {
  const options = { ...DEFAULT_OPTIONS, ...userOptions };
  
  // Validate that either projectId or taskId is provided
  if (!options.projectId && !options.taskId) {
    throw new Error('Either projectId or taskId must be provided');
  }
  
  const cacheDir = join(options.outputDir, '.openapi-partner-cache');
  const manifestPath = join(cacheDir, 'manifest.json');
  
  let cachedManifest: CachedManifest | null = null;
  let serverRestartCount = 0;
  
  return {
    name: 'vite-plugin-openapi-partner',
    
    async configResolved(config) {
      // Increment server restart counter
      serverRestartCount++;
      const currentRestart = serverRestartCount;
      
      // Load cached manifest if exists
      if (existsSync(manifestPath)) {
        try {
          cachedManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        } catch {
          // Ignore cache read errors
        }
      }
      
      // Check if we need to fetch
      const shouldFetch = 
        options.clearCache ||
        !cachedManifest ||
        Date.now() - cachedManifest.fetchedAt > options.cacheTtl;
      
      if (!shouldFetch && cachedManifest) {
        console.log(`[openapi-partner] Using cached types from task ${cachedManifest.taskId}`);
        return;
      }
      
      try {
        // Determine the download URL
        let downloadUrl: string;
        
        if (options.taskId) {
          downloadUrl = `${options.apiUrl}/api/files/${options.taskId}`;
        } else {
          // Get latest task for project
          // For now, we'll use a simple approach - in production, you'd call an API to get latest task
          console.log(`[openapi-partner] Fetching latest task for project ${options.projectId}...`);
          
          // This would ideally call /api/projects/${projectId}/latest-task
          // For now, we'll throw an error with guidance
          throw new Error(
            `For project-based fetching, please specify taskId or implement a /api/projects/${options.projectId}/latest-task endpoint`
          );
        }
        
        console.log(`[openapi-partner] Fetching types from ${downloadUrl}...`);
        
        // Fetch manifest
        const manifestUrl = `${options.apiUrl}/api/public`;
        
        // Fetch and extract ZIP file
        const token = options.apiToken || process.env.OPENAPI_PARTNER_TOKEN;
        
        if (!token) {
          throw new Error('API token required. Set OPENAPI_PARTNER_TOKEN env variable or provide apiToken option.');
        }
        
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${token}`,
        };
        
        // Get task info to find output files
        const taskResponse = await fetch(`${options.apiUrl}/api/tasks/${options.taskId}`, { headers });
        if (!taskResponse.ok) {
          throw new Error(`Failed to get task info: ${taskResponse.status}`);
        }
        
        const task = await taskResponse.json();
        const outputFiles: string[] = task.outputFiles ? JSON.parse(task.outputFiles) : ['api.ts'];
        
        // Create output directory
        if (!existsSync(options.outputDir)) {
          mkdirSync(options.outputDir, { recursive: true });
        }
        
        // Fetch each file
        for (const fileName of outputFiles) {
          const fileUrl = `${options.apiUrl}/api/files/${options.taskId}/${fileName}`;
          const destPath = join(options.outputDir, fileName);
          await fetchAndSaveFile(fileUrl, destPath, token);
          console.log(`[openapi-partner] Fetched ${fileName}`);
        }
        
        // Save cache manifest
        if (!existsSync(cacheDir)) {
          mkdirSync(cacheDir, { recursive: true });
        }
        
        cachedManifest = {
          taskId: options.taskId || task.id,
          files: outputFiles.map(name => ({ name, path: join(options.outputDir, name) })),
          fetchedAt: Date.now(),
        };
        
        writeFileSync(manifestPath, JSON.stringify(cachedManifest, null, 2));
        console.log(`[openapi-partner] Types cached successfully`);
        
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[openapi-partner] Failed to fetch types: ${message}`);
        
        // Don't fail the build if we have cached data
        if (!cachedManifest) {
          throw error;
        }
        
        console.warn(`[openapi-partner] Using stale cache due to fetch error`);
      }
    },
    
    configureServer(server) {
      // Watch for cache clear
      if (options.clearCache && cachedManifest) {
        server.ws.on('openapi-partner:clear-cache', () => {
          cachedManifest = null;
          if (existsSync(cacheDir)) {
            const { rmSync } = require('fs');
            rmSync(cacheDir, { recursive: true });
          }
        });
      }
    },
  };
}
