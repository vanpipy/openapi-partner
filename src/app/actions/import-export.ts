'use server';

import { z } from 'zod';
import { initDatabase, configs, type Config, Environment, ConfigType } from '@/lib/db';
import { createConfigSchema } from '@/lib/validation';

/**
 * Export configs to JSON format
 */
export async function exportConfigsAction(
  environment?: Environment
): Promise<{ success: true; data: ExportData } | { success: false; error: string }> {
  try {
    const { db } = initDatabase();

    const conditions = [environment ? { environment } : null].filter(Boolean);
    const results = await db.select().from(configs).all();

    // Filter by environment if specified
    const filtered = environment
      ? results.filter((c) => c.environment === environment && !c.deletedAt)
      : results.filter((c) => !c.deletedAt);

    const exportData: ExportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      environment: environment || 'all',
      configs: filtered.map((c) => ({
        key: c.key,
        value: c.value,
        type: c.type,
        environment: c.environment,
        description: c.description || undefined,
      })),
    };

    return { success: true, data: exportData };
  } catch (error) {
    console.error('exportConfigsAction error:', error);
    return { success: false, error: 'Failed to export configs' };
  }
}

/**
 * Import configs from JSON
 */
export async function importConfigsAction(
  input: ImportInput
): Promise<{ success: true; imported: number; skipped: number } | { success: false; error: string }> {
  try {
    const { db } = initDatabase();
    const importedSchema = z.object({
      key: z.string(),
      value: z.string(),
      type: z.enum(['string', 'number', 'boolean', 'json']),
      environment: z.enum(['development', 'production']),
      description: z.string().optional(),
    });

    const importData = z.object({
      configs: z.array(importSchema),
    }).parse(input);

    let imported = 0;
    let skipped = 0;
    const now = new Date();

    for (const config of importData.configs) {
      // Check if config already exists
      const existing = await db
        .select()
        .from(configs)
        .where(
          // Simplified - in production use proper query builder
          (c) => c.key === config.key && c.environment === config.environment && !c.deletedAt
        )
        .get();

      if (existing) {
        skipped++;
        continue;
      }

      await db.insert(configs).values({
        key: config.key,
        value: config.value,
        type: config.type,
        environment: config.environment,
        description: config.description,
        createdAt: now,
        updatedAt: now,
      });

      imported++;
    }

    return { success: true, imported, skipped };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: `Invalid import format: ${error.errors[0].message}` };
    }
    console.error('importConfigsAction error:', error);
    return { success: false, error: 'Failed to import configs' };
  }
}

/**
 * Download configs as JSON file
 */
export async function downloadConfigsAction(environment?: Environment): Promise<{ success: true; content: string; filename: string } | { success: false; error: string }> {
  const result = await exportConfigsAction(environment);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const content = JSON.stringify(result.data, null, 2);
  const timestamp = new Date().toISOString().split('T')[0];
  const env = environment || 'all';
  const filename = `configs-${env}-${timestamp}.json`;

  return { success: true, content, filename };
}

// Types
export interface ExportData {
  version: string;
  exportedAt: string;
  environment: Environment | 'all';
  configs: Array<{
    key: string;
    value: string;
    type: ConfigType;
    environment: Environment;
    description?: string;
  }>;
}

export interface ImportInput {
  configs: Array<{
    key: string;
    value: string;
    type: string;
    environment: string;
    description?: string;
  }>;
}
