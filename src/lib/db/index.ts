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

/**
 * Initialize database client with WAL mode for better concurrency
 */
export function initDatabase() {
  if (client) return { db, client };

  const databasePath = process.env.DATABASE_PATH || './data/config.db';
  
  // Use file: protocol for local SQLite
  const databaseUrl = process.env.DATABASE_URL || `file:${databasePath}`;

  client = createClient({
    url: databaseUrl,
  });

  db = drizzle(client, { schema });

  // Enable WAL mode for better concurrency (non-blocking reads during writes)
  // WAL mode allows concurrent reads while writing
  try {
    client.executeSync('PRAGMA journal_mode=WAL');
    client.executeSync('PRAGMA busy_timeout=5000'); // 5 second timeout
    client.executeSync('PRAGMA synchronous=NORMAL');
  } catch (e) {
    console.warn('Could not set SQLite PRAGMA settings:', e);
  }
  
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
