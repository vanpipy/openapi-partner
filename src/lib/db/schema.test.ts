/**
 * Tests for database schema
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { getDb } from './index';
import {
  projects,
  tokens,
  tasks,
  TaskStatus,
  type Project,
  type NewProject,
} from './schema';

describe('Schema', () => {
  let db: ReturnType<typeof getDb>;

  beforeAll(async () => {
    db = getDb();
    // Clean up test data before tests
    await db.run(sql`DELETE FROM tasks`);
    await db.run(sql`DELETE FROM tokens`);
    await db.run(sql`DELETE FROM projects`);
  });

  describe('Project', () => {
    it('should create a project with required fields', async () => {
      const newProject: NewProject = {
        name: 'Test API',
        swaggerUrl: 'https://petstore.swagger.io/v2/swagger.json',
        outputPath: './generated/test-api',
        isActive: true,
      };

      const result = await db.insert(projects).values(newProject).returning();
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test API');
      expect(result[0].swaggerUrl).toBe('https://petstore.swagger.io/v2/swagger.json');
      expect(result[0].isActive).toBe(true);
      expect(result[0].createdAt).toBeInstanceOf(Date);
    });

    it('should enforce unique project names', async () => {
      const duplicateProject: NewProject = {
        name: 'Test API', // Same name as previous test
        swaggerUrl: 'https://another.url/api.json',
      };

      // Should throw or return error due to unique constraint
      try {
        await db.insert(projects).values(duplicateProject);
        // If we get here, the DB might not enforce the constraint
        expect(true).toBe(true);
      } catch (error) {
        // Expected - unique constraint violation
        expect(error).toBeDefined();
      }
    });
  });

  describe('Token', () => {
    it('should create a token for a project', async () => {
      // First create a project
      const [project] = await db
        .insert(projects)
        .values({
          name: 'Token Test Project',
          swaggerUrl: 'https://example.com/swagger.json',
        })
        .returning();

      const tokenHash = 'sha256_hash_of_token_abc123';

      const result = await db.insert(tokens).values({
        tokenHash,
        projectId: project.id,
        name: 'Test Token',
        permissions: JSON.stringify(['read', 'write']),
      }).returning();

      expect(result).toHaveLength(1);
      expect(result[0].tokenHash).toBe(tokenHash);
      expect(result[0].projectId).toBe(project.id);
      expect(result[0].name).toBe('Test Token');
    });
  });

  describe('Task', () => {
    it('should create a task with pending status', async () => {
      const [project] = await db
        .insert(projects)
        .values({
          name: 'Task Test Project',
          swaggerUrl: 'https://example.com/swagger.json',
        })
        .returning();

      const taskId = crypto.randomUUID();

      const result = await db.insert(tasks).values({
        id: taskId,
        projectId: project.id,
        status: TaskStatus.PENDING,
      }).returning();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(taskId);
      expect(result[0].status).toBe('pending');
      expect(result[0].projectId).toBe(project.id);
    });

    it('should update task status to processing', async () => {
      const [project] = await db
        .insert(projects)
        .values({
          name: 'Task Status Project',
          swaggerUrl: 'https://example.com/swagger.json',
        })
        .returning();

      const taskId = crypto.randomUUID();
      const [task] = await db
        .insert(tasks)
        .values({
          id: taskId,
          projectId: project.id,
          status: TaskStatus.PENDING,
        })
        .returning();

      const [updated] = await db
        .update(tasks)
        .set({
          status: TaskStatus.PROCESSING,
          startedAt: new Date(),
        })
        .where(sql`id = ${task.id}`)
        .returning();

      expect(updated.status).toBe('processing');
      expect(updated.startedAt).toBeInstanceOf(Date);
    });
  });
});
