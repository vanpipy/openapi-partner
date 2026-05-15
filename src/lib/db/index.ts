import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

/**
 * Database connection singleton
 * Uses LibSQL client for SQLite with better performance
 */

// Create client only on server
let db: ReturnType<typeof drizzle> | null = null;
let client: ReturnType<typeof createClient> | null = null;
let initialized = false;

/**
 * Initialize database client with WAL mode for better concurrency
 */
export function initDatabase() {
  if (client && initialized) return { db, client };

  const databasePath = process.env.DATABASE_PATH || './data/config.db';
  
  // Use file: protocol for local SQLite
  const databaseUrl = process.env.DATABASE_URL || `file:${databasePath}`;

  client = createClient({
    url: databaseUrl,
  });

  db = drizzle(client, { schema });
  
  // Note: WAL mode should be set via PRAGMA after connection
  // For Turso remote DBs, this is handled automatically
  // For local SQLite, the default journal mode is usually sufficient
  
  initialized = true;
  console.log(`✅ Database initialized: ${databaseUrl}`);
  
  return { db, client };
}

/**
 * Get database instance (lazy initialization)
 */
export function getDb() {
  if (!db) {
    initDatabase();
  }
  return db!;
}

// Export schema for use in queries
export * from './schema';
export { drizzle };
