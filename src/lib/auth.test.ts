/**
 * Tests for token-based authentication
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import {
  generateToken,
  hashToken,
  verifyToken,
  previewToken,
  parseBearerToken,
  hasPermission,
  createToken,
  validateToken,
  revokeToken,
  listTokens,
  Permission,
} from './auth';
import { getDb } from './db';
import { projects, tokens } from './db/schema';

describe('Token Generation', () => {
  it('should generate a 32-character URL-safe token', async () => {
    const token = await generateToken();
    expect(token).toHaveLength(32);
    expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
  });

  it('should generate unique tokens each time', async () => {
    const token1 = await generateToken();
    const token2 = await generateToken();
    expect(token1).not.toBe(token2);
  });

  it('should preview token correctly', () => {
    const token = 'abcdefgh123456789012345678901234';
    expect(previewToken(token)).toBe('abcdefgh...');
    expect(previewToken('short')).toBe('short');
  });
});

describe('Token Hashing', () => {
  it('should hash token consistently', () => {
    const token = 'test-token-123';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different tokens', () => {
    const hash1 = hashToken('token-1');
    const hash2 = hashToken('token-2');
    expect(hash1).not.toBe(hash2);
  });

  it('should verify token against hash', () => {
    const token = 'my-secret-token';
    const hash = hashToken(token);
    expect(verifyToken(token, hash)).toBe(true);
    expect(verifyToken('wrong-token', hash)).toBe(false);
  });

  it('should produce 64-character SHA-256 hash', () => {
    const hash = hashToken('any-token');
    expect(hash).toHaveLength(64);
    expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
  });
});

describe('Bearer Token Parsing', () => {
  it('should parse valid Bearer header', () => {
    const token = parseBearerToken('Bearer abc123');
    expect(token).toBe('abc123');
  });

  it('should handle lowercase bearer', () => {
    const token = parseBearerToken('bearer xyz789');
    expect(token).toBe('xyz789');
  });

  it('should return null for invalid format', () => {
    expect(parseBearerToken(null)).toBeNull();
    expect(parseBearerToken('')).toBeNull();
    expect(parseBearerToken('Basic abc123')).toBeNull();
    expect(parseBearerToken('Bearer')).toBeNull();
    expect(parseBearerToken('Bearer token extra')).toBeNull();
  });
});

describe('Permission Check', () => {
  it('should check basic permissions', () => {
    const perms = [Permission.READ, Permission.WRITE];
    expect(hasPermission(perms, 'read')).toBe(true);
    expect(hasPermission(perms, 'write')).toBe(true);
    expect(hasPermission(perms, 'admin')).toBe(false);
  });

  it('should grant all access for admin permission', () => {
    const perms = [Permission.ADMIN];
    expect(hasPermission(perms, 'read')).toBe(true);
    expect(hasPermission(perms, 'write')).toBe(true);
    expect(hasPermission(perms, 'delete')).toBe(true);
    expect(hasPermission(perms, 'anything')).toBe(true);
  });
});

describe('Token Management', () => {
  let db: ReturnType<typeof getDb>;
  let testProjectId: number;

  beforeAll(async () => {
    db = getDb();

    // Clean up
    await db.run(sql`DELETE FROM tasks`);
    await db.run(sql`DELETE FROM tokens`);
    await db.run(sql`DELETE FROM projects`);

    // Create test project
    const [project] = await db
      .insert(projects)
      .values({
        name: 'Auth Test Project',
        swaggerUrl: 'https://example.com/swagger.json',
      })
      .returning();
    testProjectId = project.id;
  });

  afterAll(async () => {
    // Clean up
    await db.run(sql`DELETE FROM tasks`);
    await db.run(sql`DELETE FROM tokens`);
    await db.run(sql`DELETE FROM projects`);
  });

  it('should create a token for a project', async () => {
    const result = await createToken({
      projectId: testProjectId,
      name: 'Test Token',
      permissions: ['read', 'write'],
    });

    expect(result.success).toBe(true);
    expect(result.token).toHaveLength(32);
    expect(result.tokenRecord.name).toBe('Test Token');
  });

  it('should validate a valid token', async () => {
    const createResult = await createToken({
      projectId: testProjectId,
      name: 'Validate Test',
      permissions: ['read'],
    });

    if (!createResult.success) throw new Error('Failed to create token');

    const validateResult = await validateToken(createResult.token);

    expect(validateResult.success).toBe(true);
    expect(validateResult.token.name).toBe('Validate Test');
    expect(validateResult.project.id).toBe(testProjectId);
  });

  it('should reject invalid token', async () => {
    const result = await validateToken('invalid-token-123');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid token');
  });

  it('should reject expired token', async () => {
    const result = await createToken({
      projectId: testProjectId,
      name: 'Expired Token',
      expiresInDays: -1, // Already expired
    });

    if (!result.success) throw new Error('Failed to create token');

    const validateResult = await validateToken(result.token);
    expect(validateResult.success).toBe(false);
    expect(validateResult.error).toBe('Token expired');
  });

  it('should list tokens for a project', async () => {
    await createToken({
      projectId: testProjectId,
      name: 'List Token 1',
    });
    await createToken({
      projectId: testProjectId,
      name: 'List Token 2',
    });

    const tokenList = await listTokens(testProjectId);
    expect(tokenList.length).toBeGreaterThanOrEqual(2);
  });

  it('should revoke a token', async () => {
    const createResult = await createToken({
      projectId: testProjectId,
      name: 'Revoke Test',
    });

    if (!createResult.success) throw new Error('Failed to create token');

    const tokenId = Number(createResult.tokenRecord.id);
    
    // Verify token exists before revoke
    const beforeList = await listTokens(testProjectId);
    const existsBefore = beforeList.some(t => Number(t.id) === tokenId);
    expect(existsBefore).toBe(true);

    // Revoke
    await revokeToken(tokenId);

    // Verify token is gone after revoke
    const afterList = await listTokens(testProjectId);
    const existsAfter = afterList.some(t => Number(t.id) === tokenId);
    expect(existsAfter).toBe(false);

    // Verify token is no longer valid
    const validateResult = await validateToken(createResult.token);
    expect(validateResult.success).toBe(false);
  });
});
