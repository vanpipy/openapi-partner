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
  clientOptions: text('client_options'),
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
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    projectIdIdx: index('tasks_project_id_idx').on(table.projectId),
    statusIdx: index('tasks_status_idx').on(table.status),
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
// Type exports
// ============================================

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type Token = typeof tokens.$inferSelect;
export type NewToken = typeof tokens.$inferInsert;

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
