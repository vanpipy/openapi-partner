import { z } from 'zod';

/**
 * Environment variables schema validation using Zod
 * 
 * Security: Only variables prefixed with NEXT_PUBLIC_ are exposed to the client.
 * Server-only variables (DATABASE_PATH, SESSION_SECRET) stay on the server.
 */

// Environment schema definition
const envSchema = z.object({
  // Node environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Database configuration (server-only, not exposed to client)
  DATABASE_PATH: z.string().default('./data/config.db'),
  DATABASE_URL: z.string().optional(),

  // Session configuration (server-only)
  SESSION_SECRET: z.string().min(32).optional(),
  SESSION_MAX_AGE: z.coerce.number().default(86400), // 24 hours

  // Client-exposed variables (must be prefixed with NEXT_PUBLIC_)
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_APP_NAME: z.string().default('Config Platform'),

  // Optional: Webhook configuration
  WEBHOOK_URL: z.string().url().optional(),
  WEBHOOK_SECRET: z.string().optional(),
});

// Type inference from schema
export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables at runtime
 * Throws an error if validation fails (fails fast on startup)
 */
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    throw new Error('Invalid environment configuration - check your .env file');
  }
  
  console.log(`✅ Environment validated: ${result.data.NODE_ENV}`);
  return result.data;
}

/**
 * Get validated environment (cached after first call)
 */
let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;
  cachedEnv = validateEnv();
  return cachedEnv;
}

// Export schema for testing/validation utilities
export { envSchema };
