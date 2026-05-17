import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ============================================
// Enums
// ============================================

export const TaskStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TokenPermission = {
  READ: 'read',
  WRITE: 'write',
  ADMIN: 'admin',
} as const;

export type TokenPermission = (typeof TokenPermission)[keyof typeof TokenPermission];

// Spec type for OpenAPI/Swagger versions
export const SpecType = {
  AUTO_DETECT: 'auto-detect',
  OPENAPI_3X: 'openapi3x',
  SWAGGER_2X: 'swagger2x',
} as const;

export type SpecType = (typeof SpecType)[keyof typeof SpecType];

// ============================================
// Generator Options (swagger-typescript-api)
// ============================================

export interface GeneratorOptions {
  /** Generate separated files for http client, data contracts, and routes */
  modular?: boolean;
  /** Skip API client class - types only */
  typesOnly?: boolean;
  /** Generate type definitions for API routes */
  routeTypes?: boolean;
  /** Extract enums to TypeScript enums */
  extractEnums?: boolean;
  /** Extract all responses described in /components/responses */
  extractResponses?: boolean;
  /** Extract request body type to data contract */
  extractRequestBody?: boolean;
  /** Extract request params to data contract */
  extractRequestParams?: boolean;
  /** Extract response error type to data contract */
  extractResponseError?: boolean;
  /** Generate readonly properties */
  readonly?: boolean;
  /** Generate all enum types as union types (T1 | T2 | TN) */
  unionEnums?: boolean;
  /** Sort fields and types */
  sortTypes?: boolean;
  /** Sort routes in alphabetical order */
  sortRoutes?: boolean;
}

export const DEFAULT_GENERATOR_OPTIONS: GeneratorOptions = {
  modular: true,
  typesOnly: true,
  routeTypes: true,
  extractEnums: true,
  extractResponses: true,
  extractRequestBody: true,
  extractRequestParams: true,
  sortTypes: true,
  sortRoutes: true,
};

// ============================================
// Projects Table (Core Configuration)
// ============================================

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  specUrl: text('spec_url').notNull(), // Renamed from swaggerUrl
  specType: text('spec_type', {
    enum: [SpecType.AUTO_DETECT, SpecType.OPENAPI_3X, SpecType.SWAGGER_2X],
  }).notNull().default(SpecType.AUTO_DETECT),
  specVersion: text('spec_version'), // Auto-detected version
  wasConvertedFromSwagger2: integer('was_converted', { mode: 'boolean' }).default(false),
  outputPath: text('output_path').notNull().default('./generated'),
  apiVersion: text('api_version'),
  baseUrl: text('base_url'),
  customTemplates: text('custom_templates'),
  generatorOptions: text('generator_options'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdBy: text('created_by'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Projects relations
export const projectsRelations = relations(projects, ({ many }) => ({
  tokens: many(tokens),
  tasks: many(tasks),
}));

// ============================================
// Tokens Table (Access Authorization)
// ============================================

export const tokens = sqliteTable('tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tokenHash: text('token_hash').notNull(),
  projectId: integer('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  permissions: text('permissions').notNull().default('["read"]'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Tokens relations
export const tokensRelations = relations(tokens, ({ one }) => ({
  project: one(projects, {
    fields: [tokens.projectId],
    references: [projects.id],
  }),
}));

// ============================================
// Tasks Table (Sync Task Lifecycle)
// ============================================

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(), // UUID
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    status: text('status', {
      enum: [
        TaskStatus.PENDING,
        TaskStatus.PROCESSING,
        TaskStatus.SUCCESS,
        TaskStatus.FAILED,
      ],
    })
      .notNull()
      .default(TaskStatus.PENDING),
    errorMessage: text('error_message'),
    executionLog: text('execution_log'),
    startedAt: integer('started_at', { mode: 'timestamp' }),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    // Generated files metadata
    outputDir: text('output_dir'), // Path to generated files directory
    outputFiles: text('output_files'), // JSON array of generated file names
    outputSize: integer('output_size'), // Total size in bytes
    downloadCount: integer('download_count').default(0),
    publicToken: text('public_token'), // UUID for public download (optional)
    // Pending SSE events for new clients to receive on connect
    sseEvents: text('sse_events').default('[]'), // JSON array of events
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    projectIdIdx: index('tasks_project_id_idx').on(table.projectId),
    statusIdx: index('tasks_status_idx').on(table.status),
    publicTokenIdx: uniqueIndex('tasks_public_token_idx').on(table.publicToken),
  })
);

// Tasks relations
export const tasksRelations = relations(tasks, ({ one }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
}));

// ============================================
// Users Table
// ============================================

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('viewer'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ============================================
// Sessions Table
// ============================================

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ============================================
// Configs Table
// ============================================

export const configs = sqliteTable('configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull(),
  value: text('value').notNull(),
  type: text('type').notNull(),
  environment: text('environment').notNull(),
  description: text('description'),
  validation: text('validation'),
  createdBy: integer('created_by').references(() => users.id),
  updatedBy: integer('updated_by').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

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
  changedBy: integer('changed_by').references(() => users.id),
  changedAt: integer('changed_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  changeReason: text('change_reason'),
});

// ============================================
// Type exports
// ============================================

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type Token = typeof tokens.$inferSelect;
export type NewToken = typeof tokens.$inferInsert;

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Config = typeof configs.$inferSelect;
export type NewConfig = typeof configs.$inferInsert;

export type ConfigHistory = typeof configHistory.$inferSelect;
export type NewConfigHistory = typeof configHistory.$inferInsert;
