import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { eq, and, gt } from 'drizzle-orm';
import { getDb, tokens, projects, type Token, type Project } from './db';

/**
 * Token-based authentication library
 * For external system access and API authentication
 */

// ============================================
// Token Generation (Web Crypto API)
// ============================================

/**
 * Generate a secure random token using Web Crypto API
 * Returns a 32-character URL-safe Base64 string
 */
export async function generateToken(): Promise<string> {
  const buffer = new Uint8Array(24); // 24 bytes = 32 base64 characters
  crypto.getRandomValues(buffer);
  return Buffer.from(buffer).toString('base64url');
}

/**
 * Generate a token preview (for display before saving)
 * Shows first 8 characters of the token
 */
export function previewToken(token: string): string {
  if (token.length <= 8) return token;
  return `${token.slice(0, 8)}...`;
}

// ============================================
// Token Hashing (SHA-256)
// ============================================

/**
 * Hash a token using SHA-256
 * Tokens are stored as hashes for security
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Verify a token against its hash
 */
export function verifyToken(token: string, tokenHash: string): boolean {
  const hash = hashToken(token);
  try {
    const hashBuffer = Buffer.from(hash, 'hex');
    const storedBuffer = Buffer.from(tokenHash, 'hex');
    return timingSafeEqual(hashBuffer, storedBuffer);
  } catch {
    return false;
  }
}

// ============================================
// Token Management
// ============================================

export interface CreateTokenOptions {
  projectId: number;
  name: string;
  permissions?: string[];
  expiresInDays?: number;
}

/**
 * Create a new token for a project
 */
export async function createToken(options: CreateTokenOptions): Promise<{
  success: true;
  token: string;
  tokenRecord: Token;
} | {
  success: false;
  error: string;
}> {
  const db = getDb();

  // Verify project exists
  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, options.projectId))
    .get();

  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  // Generate token and hash
  const plainToken = await generateToken();
  const tokenHash = hashToken(plainToken);

  // Calculate expiration
  const expiresAt = options.expiresInDays
    ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  // Default permissions
  const permissions = options.permissions ?? ['read'];

  // Insert token record
  const [tokenRecord] = await db
    .insert(tokens)
    .values({
      tokenHash,
      projectId: options.projectId,
      name: options.name,
      permissions: JSON.stringify(permissions),
      expiresAt,
    })
    .returning();

  return {
    success: true,
    token: plainToken, // Return plain token ONLY ONCE
    tokenRecord,
  };
}

/**
 * Validate a bearer token
 */
export async function validateToken(token: string): Promise<{
  success: true;
  token: Token;
  project: Project;
} | {
  success: false;
  error: string;
}> {
  const db = getDb();
  const tokenHash = hashToken(token);

  // Find token by hash
  const result = await db
    .select()
    .from(tokens)
    .innerJoin(projects, eq(tokens.projectId, projects.id))
    .where(eq(tokens.tokenHash, tokenHash))
    .get();

  if (!result) {
    return { success: false, error: 'Invalid token' };
  }

  // Check expiration
  if (result.tokens.expiresAt && new Date(result.tokens.expiresAt) < new Date()) {
    return { success: false, error: 'Token expired' };
  }

  // Update last used timestamp
  await db
    .update(tokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(tokens.id, result.tokens.id));

  return {
    success: true,
    token: result.tokens,
    project: result.projects,
  };
}

/**
 * Parse Bearer token from Authorization header
 */
export function parseBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Check if token has specific permission
 */
export function hasPermission(permissions: string[], action: string): boolean {
  // 'admin' permission grants all access
  if (permissions.includes('admin')) return true;
  return permissions.includes(action);
}

/**
 * Revoke a token
 */
export async function revokeToken(tokenId: number): Promise<boolean> {
  const db = getDb();

  const result = await db
    .delete(tokens)
    .where(eq(tokens.id, tokenId))
    .run();

  return result.changes > 0;
}

/**
 * List all tokens for a project
 */
export async function listTokens(projectId: number): Promise<Token[]> {
  const db = getDb();

  return db
    .select()
    .from(tokens)
    .where(eq(tokens.projectId, projectId))
    .all();
}

// ============================================
// Permission Types
// ============================================

export const Permission = {
  READ: 'read',
  WRITE: 'write',
  ADMIN: 'admin',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];
