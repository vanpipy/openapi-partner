import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle/migrations',
  
  // Database connection
  dialect: 'sqlite',
  dbCredentials: {
    // Uses DATABASE_PATH env variable or defaults to ./data/config.db
    url: process.env.DATABASE_URL || `file:${process.env.DATABASE_PATH || './data/config.db'}`,
  },
  
  // Print SQL statements
  verbose: true,
  
  // Strict mode
  strict: true,
});
