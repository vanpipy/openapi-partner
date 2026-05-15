/**
 * Tests for spec version detection
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'bun:test';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { projects, tasks } from '@/lib/db/schema';
import { SpecType } from '@/lib/db/schema';
import { TaskStatus } from '@/lib/db/schema';

// Mock the spec detection logic
const detectSpecVersion = async (spec: { openapi?: string; swagger?: string }): Promise<{
  specType: typeof SpecType[keyof typeof SpecType];
  specVersion: string;
  wasConverted: boolean;
}> => {
  if (spec.openapi) {
    return {
      specType: SpecType.OPENAPI_3X,
      specVersion: spec.openapi.toString(),
      wasConverted: false,
    };
  }
  
  if (spec.swagger === '2.0') {
    return {
      specType: SpecType.SWAGGER_2X,
      specVersion: '2.0',
      wasConverted: true,
    };
  }
  
  return {
    specType: SpecType.OPENAPI_3X,
    specVersion: '3.0.0',
    wasConverted: false,
  };
};

describe('Spec Version Detection', () => {
  describe('OpenAPI 3.x Detection', () => {
    it('should detect OpenAPI 3.0', async () => {
      const result = await detectSpecVersion({ openapi: '3.0.0' });
      expect(result.specType).toBe(SpecType.OPENAPI_3X);
      expect(result.specVersion).toBe('3.0.0');
      expect(result.wasConverted).toBe(false);
    });

    it('should detect OpenAPI 3.1', async () => {
      const result = await detectSpecVersion({ openapi: '3.1.0' });
      expect(result.specType).toBe(SpecType.OPENAPI_3X);
      expect(result.specVersion).toBe('3.1.0');
      expect(result.wasConverted).toBe(false);
    });

    it('should detect OpenAPI 3.2', async () => {
      const result = await detectSpecVersion({ openapi: '3.2.0' });
      expect(result.specType).toBe(SpecType.OPENAPI_3X);
      expect(result.specVersion).toBe('3.2.0');
      expect(result.wasConverted).toBe(false);
    });
  });

  describe('Swagger 2.0 Detection', () => {
    it('should detect Swagger 2.0', async () => {
      const result = await detectSpecVersion({ swagger: '2.0' });
      expect(result.specType).toBe(SpecType.SWAGGER_2X);
      expect(result.specVersion).toBe('2.0');
      expect(result.wasConverted).toBe(true);
    });

    it('should mark Swagger 2.0 as converted', async () => {
      const result = await detectSpecVersion({ swagger: '2.0' });
      expect(result.wasConverted).toBe(true);
    });
  });

  describe('Fallback Detection', () => {
    it('should fallback to OpenAPI 3.0 for unknown specs', async () => {
      const result = await detectSpecVersion({});
      expect(result.specType).toBe(SpecType.OPENAPI_3X);
      expect(result.specVersion).toBe('3.0.0');
      expect(result.wasConverted).toBe(false);
    });
  });

  describe('SpecType Enum Values', () => {
    it('should have correct SpecType values', () => {
      expect(SpecType.AUTO_DETECT).toBe('auto-detect');
      expect(SpecType.OPENAPI_3X).toBe('openapi3x');
      expect(SpecType.SWAGGER_2X).toBe('swagger2x');
    });
  });
});

describe('Project with Spec Fields', () => {
  let db: ReturnType<typeof getDb>;

  beforeAll(async () => {
    db = getDb();
    await db.run(sql`DELETE FROM tasks`);
    await db.run(sql`DELETE FROM tokens`);
    await db.run(sql`DELETE FROM projects`);
  });

  afterAll(async () => {
    await db.run(sql`DELETE FROM tasks`);
    await db.run(sql`DELETE FROM tokens`);
    await db.run(sql`DELETE FROM projects`);
  });

  it('should create project with auto-detect spec type', async () => {
    const [project] = await db
      .insert(projects)
      .values({
        name: 'Auto Detect Test',
        specUrl: 'https://petstore.swagger.io/v2/swagger.json',
        specType: SpecType.AUTO_DETECT,
      })
      .returning();

    expect(project.specUrl).toBe('https://petstore.swagger.io/v2/swagger.json');
    expect(project.specType).toBe(SpecType.AUTO_DETECT);
    expect(project.specVersion).toBeNull();
    expect(project.wasConvertedFromSwagger2).toBe(false);
  });

  it('should create project with explicit OpenAPI 3.x', async () => {
    const [project] = await db
      .insert(projects)
      .values({
        name: 'OpenAPI 3.1 Test',
        specUrl: 'https://api.example.com/openapi.json',
        specType: SpecType.OPENAPI_3X,
        specVersion: '3.1.0',
        wasConvertedFromSwagger2: false,
      })
      .returning();

    expect(project.specType).toBe(SpecType.OPENAPI_3X);
    expect(project.specVersion).toBe('3.1.0');
    expect(project.wasConvertedFromSwagger2).toBe(false);
  });

  it('should update spec version after detection', async () => {
    const [project] = await db
      .insert(projects)
      .values({
        name: 'Update Spec Version Test',
        specUrl: 'https://api.example.com/spec.json',
        specType: SpecType.AUTO_DETECT,
      })
      .returning();

    await db
      .update(projects)
      .set({
        specType: SpecType.OPENAPI_3X,
        specVersion: '3.1.0',
        wasConvertedFromSwagger2: false,
      })
      .where(sql`id = ${project.id}`);

    const updated = await db
      .select()
      .from(projects)
      .where(sql`id = ${project.id}`)
      .get();

    expect(updated?.specType).toBe(SpecType.OPENAPI_3X);
    expect(updated?.specVersion).toBe('3.1.0');
    expect(updated?.wasConvertedFromSwagger2).toBe(false);
  });
});
