import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

/**
 * Database Schema for Config Platform
 * Using Drizzle ORM with SQLite (LibSQL)
 */

// ============================================
// Enums
// ============================================

export const UserRole = {
  VIEWER: 'viewer',
  EDITOR: 'editor',
  ADMIN: 'admin',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ConfigType = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  JSON: 'json',
} as const;

export type ConfigType = (typeof ConfigType)[keyof typeof ConfigType];

export const Environment = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
} as const;

export type Environment = (typeof Environment)[keyof typeof Environment];

// ============================================
// Users Table
// ============================================

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: [UserRole.VIEWER, UserRole.EDITOR, UserRole.ADMIN] })
    .notNull()
    .default(UserRole.VIEWER),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Users relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  configsCreated: many(configs, { relationName: 'createdBy' }),
  configsUpdated: many(configs, { relationName: 'updatedBy' }),
  configHistory: many(configHistory),
}));

// ============================================
// Sessions Table
// ============================================

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), // UUID
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Sessions relations
export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// ============================================
// Configs Table
// ============================================

export const configs = sqliteTable(
  'configs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    key: text('key').notNull(),
    value: text('value').notNull(), // JSON stringified
    type: text('type', {
      enum: [ConfigType.STRING, ConfigType.NUMBER, ConfigType.BOOLEAN, ConfigType.JSON],
    }).notNull(),
    environment: text('environment', {
      enum: [Environment.DEVELOPMENT, Environment.PRODUCTION],
    }).notNull(),
    description: text('description'),
    validation: text('validation'), // JSON Schema for validation rules
    createdById: integer('created_by').references(() => users.id),
    updatedById: integer('updated_by').references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }), // Soft delete
  },
  (table) => ({
    // Unique constraint on key + environment
    keyEnvironmentIdx: uniqueIndex('key_environment_idx').on(table.key, table.environment),
  })
);

// Configs relations
export const configsRelations = relations(configs, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [configs.createdById],
    references: [users.id],
    relationName: 'createdBy',
  }),
  updatedBy: one(users, {
    fields: [configs.updatedById],
    references: [users.id],
    relationName: 'updatedBy',
  }),
  history: many(configHistory),
}));

// ============================================
// Config History Table
// ============================================

export const configHistory = sqliteTable('config_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  configId: integer('config_id')
    .notNull()
    .references(() => configs.id, { onDelete: 'cascade' }),
  oldValue: text('old_value'),
  newValue: text('new_value').notNull(),
  changedById: integer('changed_by').references(() => users.id),
  changedAt: integer('changed_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  changeReason: text('change_reason'),
});

// Config History relations
export const configHistoryRelations = relations(configHistory, ({ one }) => ({
  config: one(configs, {
    fields: [configHistory.configId],
    references: [configs.id],
  }),
  changedBy: one(users, {
    fields: [configHistory.changedById],
    references: [users.id],
  }),
}));

// ============================================
// Type exports
// ============================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Config = typeof configs.$inferSelect;
export type NewConfig = typeof configs.$inferInsert;

export type ConfigHistory = typeof configHistory.$inferSelect;
export type NewConfigHistory = typeof configHistory.$inferInsert;
