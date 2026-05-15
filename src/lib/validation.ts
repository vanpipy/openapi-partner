import { z } from 'zod';
import { ConfigType, Environment } from './db/schema';

/**
 * Config validation schemas using Zod
 */

// Config type enum
const configTypeEnum = z.enum([ConfigType.STRING, ConfigType.NUMBER, ConfigType.BOOLEAN, ConfigType.JSON]);
const environmentEnum = z.enum([Environment.DEVELOPMENT, Environment.PRODUCTION]);

/**
 * Validation rules for config values
 * Supports JSON Schema-like validation
 */
export const configValidationSchema = z.object({
  required: z.boolean().optional(),
  pattern: z.string().optional(), // Regex pattern
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  enum: z.array(z.string()).optional(),
  schema: z.record(z.any()).optional(), // JSON Schema
}).optional();

/**
 * Create config input schema
 */
export const createConfigSchema = z.object({
  key: z
    .string()
    .min(1, 'Key cannot be empty')
    .max(255, 'Key cannot exceed 255 characters')
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Key must be alphanumeric with underscores'),
  value: z.string(),
  type: configTypeEnum,
  environment: environmentEnum,
  description: z.string().max(500).optional(),
  validation: configValidationSchema,
});

/**
 * Update config input schema
 */
export const updateConfigSchema = z.object({
  id: z.number().int().positive(),
  value: z.string(),
  changeReason: z.string().max(500).optional(),
});

/**
 * Get config by key schema
 */
export const getConfigByKeySchema = z.object({
  key: z.string().min(1),
  environment: environmentEnum,
});

/**
 * List configs query schema
 */
export const listConfigsSchema = z.object({
  environment: environmentEnum.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * Type exports
 */
export type CreateConfigInput = z.infer<typeof createConfigSchema>;
export type UpdateConfigInput = z.infer<typeof updateConfigSchema>;
export type GetConfigByKeyInput = z.infer<typeof getConfigByKeySchema>;
export type ListConfigsInput = z.infer<typeof listConfigsSchema>;
export type ConfigValidation = z.infer<typeof configValidationSchema>;

/**
 * Validate config value against its type and validation rules
 */
export function validateConfigValue(
  value: string,
  type: ConfigType,
  validation?: ConfigValidation
): { valid: boolean; error?: string } {
  try {
    // Type-specific validation
    switch (type) {
      case ConfigType.NUMBER: {
        const num = Number(value);
        if (isNaN(num)) return { valid: false, error: 'Value must be a number' };
        if (validation?.minimum !== undefined && num < validation.minimum) {
          return { valid: false, error: `Value must be >= ${validation.minimum}` };
        }
        if (validation?.maximum !== undefined && num > validation.maximum) {
          return { valid: false, error: `Value must be <= ${validation.maximum}` };
        }
        break;
      }

      case ConfigType.BOOLEAN: {
        const lower = value.toLowerCase();
        if (!['true', 'false', '1', '0'].includes(lower)) {
          return { valid: false, error: 'Value must be a boolean (true/false)' };
        }
        break;
      }

      case ConfigType.JSON: {
        JSON.parse(value); // Will throw if invalid JSON
        break;
      }

      case ConfigType.STRING:
      default: {
        if (validation?.minLength !== undefined && value.length < validation.minLength) {
          return { valid: false, error: `Value must be at least ${validation.minLength} characters` };
        }
        if (validation?.maxLength !== undefined && value.length > validation.maxLength) {
          return { valid: false, error: `Value must be at most ${validation.maxLength} characters` };
        }
        if (validation?.pattern) {
          const regex = new RegExp(validation.pattern);
          if (!regex.test(value)) {
            return { valid: false, error: `Value does not match pattern: ${validation.pattern}` };
          }
        }
        break;
      }
    }

    // Enum validation (applies to string representation)
    if (validation?.enum && !validation.enum.includes(value)) {
      return { valid: false, error: `Value must be one of: ${validation.enum.join(', ')}` };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid value format' };
  }
}
