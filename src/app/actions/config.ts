'use server';

import { z } from 'zod';
import { eq, and, like, isNull, desc } from 'drizzle-orm';
import { initDatabase, configs, configHistory, NewConfig, Config } from '@/lib/db';
import {
  createConfigSchema,
  updateConfigSchema,
  getConfigByKeySchema,
  listConfigsSchema,
  validateConfigValue,
} from '@/lib/validation';

/**
 * Error response type
 */
export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Create a new configuration
 */
export async function createConfigAction(
  input: z.infer<typeof createConfigSchema>
): Promise<ActionResult<Config>> {
  try {
    // Validate input
    const validated = createConfigSchema.parse(input);
    const { db } = initDatabase();

    // Check if key already exists for this environment
    const existing = await db
      .select()
      .from(configs)
      .where(
        and(
          eq(configs.key, validated.key),
          eq(configs.environment, validated.environment),
          isNull(configs.deletedAt)
        )
      )
      .get();

    if (existing) {
      return { success: false, error: `Config with key "${validated.key}" already exists in ${validated.environment}` };
    }

    // Validate value against type and rules
    const validationResult = validateConfigValue(
      validated.value,
      validated.type,
      validated.validation
    );

    if (!validationResult.valid) {
      return { success: false, error: validationResult.error || 'Invalid value' };
    }

    // Create config
    const newConfig: NewConfig = {
      key: validated.key,
      value: validated.value,
      type: validated.type,
      environment: validated.environment,
      description: validated.description,
      validation: validated.validation ? JSON.stringify(validated.validation) : null,
    };

    const result = await db.insert(configs).values(newConfig).returning().get();

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors.map((e) => e.message).join(', ') };
    }
    console.error('createConfigAction error:', error);
    return { success: false, error: 'Failed to create config' };
  }
}

/**
 * Get a single config by ID
 */
export async function getConfigAction(id: number): Promise<ActionResult<Config>> {
  try {
    const { db } = initDatabase();

    const config = await db
      .select()
      .from(configs)
      .where(and(eq(configs.id, id), isNull(configs.deletedAt)))
      .get();

    if (!config) {
      return { success: false, error: 'Config not found' };
    }

    return { success: true, data: config };
  } catch (error) {
    console.error('getConfigAction error:', error);
    return { success: false, error: 'Failed to get config' };
  }
}

/**
 * Get config by key and environment
 */
export async function getConfigByKeyAction(
  input: z.infer<typeof getConfigByKeySchema>
): Promise<ActionResult<Config>> {
  try {
    const validated = getConfigByKeySchema.parse(input);
    const { db } = initDatabase();

    const config = await db
      .select()
      .from(configs)
      .where(
        and(
          eq(configs.key, validated.key),
          eq(configs.environment, validated.environment),
          isNull(configs.deletedAt)
        )
      )
      .get();

    if (!config) {
      return { success: false, error: 'Config not found' };
    }

    return { success: true, data: config };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors.map((e) => e.message).join(', ') };
    }
    console.error('getConfigByKeyAction error:', error);
    return { success: false, error: 'Failed to get config' };
  }
}

/**
 * List configs with pagination and filtering
 */
export async function listConfigsAction(
  input?: z.infer<typeof listConfigsSchema>
): Promise<ActionResult<{ configs: Config[]; total: number }>> {
  try {
    const validated = listConfigsSchema.parse(input || {});
    const { db } = initDatabase();

    // Build where conditions
    const conditions = [isNull(configs.deletedAt)];

    if (validated.environment) {
      conditions.push(eq(configs.environment, validated.environment));
    }

    if (validated.search) {
      conditions.push(like(configs.key, `%${validated.search}%`));
    }

    // Get total count
    const countResult = await db
      .select({ count: configs.id })
      .from(configs)
      .where(and(...conditions))
      .all();

    const total = countResult.length;

    // Get paginated results
    const offset = (validated.page - 1) * validated.pageSize;
    const results = await db
      .select()
      .from(configs)
      .where(and(...conditions))
      .orderBy(desc(configs.updatedAt))
      .limit(validated.pageSize)
      .offset(offset)
      .all();

    return { success: true, data: { configs: results, total } };
  } catch (error) {
    console.error('listConfigsAction error:', error);
    return { success: false, error: 'Failed to list configs' };
  }
}

/**
 * Update a config value
 */
export async function updateConfigAction(
  input: z.infer<typeof updateConfigSchema>
): Promise<ActionResult<Config>> {
  try {
    const validated = updateConfigSchema.parse(input);
    const { db } = initDatabase();

    // Get current config
    const current = await db
      .select()
      .from(configs)
      .where(and(eq(configs.id, validated.id), isNull(configs.deletedAt)))
      .get();

    if (!current) {
      return { success: false, error: 'Config not found' };
    }

    // Parse validation rules if exists
    const validation = current.validation ? JSON.parse(current.validation) : undefined;

    // Validate new value
    const validationResult = validateConfigValue(
      validated.value,
      current.type,
      validation
    );

    if (!validationResult.valid) {
      return { success: false, error: validationResult.error || 'Invalid value' };
    }

    // Update config and create history entry in transaction-like manner
    const now = new Date();

    await db.update(configs).set({
      value: validated.value,
      updatedAt: now,
    }).where(eq(configs.id, validated.id));

    // Create history record
    await db.insert(configHistory).values({
      configId: validated.id,
      oldValue: current.value,
      newValue: validated.value,
      changeReason: validated.changeReason,
      changedAt: now,
    });

    // Get updated config
    const updated = await db
      .select()
      .from(configs)
      .where(eq(configs.id, validated.id))
      .get();

    return { success: true, data: updated! };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors.map((e) => e.message).join(', ') };
    }
    console.error('updateConfigAction error:', error);
    return { success: false, error: 'Failed to update config' };
  }
}

/**
 * Soft delete a config
 */
export async function deleteConfigAction(id: number): Promise<ActionResult<boolean>> {
  try {
    const { db } = initDatabase();

    const existing = await db
      .select()
      .from(configs)
      .where(and(eq(configs.id, id), isNull(configs.deletedAt)))
      .get();

    if (!existing) {
      return { success: false, error: 'Config not found' };
    }

    // Soft delete
    await db
      .update(configs)
      .set({ deletedAt: new Date() })
      .where(eq(configs.id, id));

    return { success: true, data: true };
  } catch (error) {
    console.error('deleteConfigAction error:', error);
    return { success: false, error: 'Failed to delete config' };
  }
}
