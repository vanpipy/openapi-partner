/**
 * Token Server Actions
 * Handles token CRUD operations for projects
 */

'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { getDb, tokens, projects } from '@/lib/db';
import {
  createToken,
  validateToken,
  revokeToken,
  listTokens,
  previewToken,
  parseBearerToken,
  type CreateTokenOptions,
} from '@/lib/auth';
import type { Token } from '@/lib/db';

// ============================================
// Token CRUD
// ============================================

export interface CreateTokenInput {
  projectId: number;
  name: string;
  permissions?: string[];
  expiresInDays?: number;
}

export interface CreateTokenResult {
  success: true;
  token: string; // Plain token (only shown once)
  tokenRecord: Token;
  preview: string;
}

export interface TokenListItem {
  id: number;
  name: string;
  preview: string;
  permissions: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

/**
 * Create a new token for a project
 */
export async function createProjectToken(input: CreateTokenInput): Promise<
  | {
      success: true;
      data: CreateTokenResult;
    }
  | {
      success: false;
      error: string;
    }
> {
  try {
    const db = getDb();

    // Verify project exists
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, input.projectId))
      .get();

    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    const options: CreateTokenOptions = {
      projectId: input.projectId,
      name: input.name,
      permissions: input.permissions ?? ['read'],
      expiresInDays: input.expiresInDays,
    };

    const result = await createToken(options);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    revalidatePath(`/projects/${input.projectId}/settings`);

    return {
      success: true,
      data: {
        token: result.token,
        tokenRecord: result.tokenRecord,
        preview: previewToken(result.token),
      },
    };
  } catch (error) {
    console.error('Failed to create token:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create token',
    };
  }
}

/**
 * Revoke a token
 */
export async function revokeProjectToken(
  tokenId: number,
  projectId: number
): Promise<{
  success: true;
} | {
  success: false;
  error: string;
}> {
  try {
    const success = await revokeToken(tokenId);

    if (!success) {
      return { success: false, error: 'Token not found or already revoked' };
    }

    revalidatePath(`/projects/${projectId}/settings`);

    return { success: true };
  } catch (error) {
    console.error('Failed to revoke token:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to revoke token',
    };
  }
}

/**
 * List all tokens for a project
 */
export async function getProjectTokens(projectId: number): Promise<TokenListItem[]> {
  const tokenList = await listTokens(projectId);

  return tokenList.map((token) => ({
    id: token.id,
    name: token.name,
    preview: previewToken(token.tokenHash), // Note: We can't show actual token
    permissions: JSON.parse(token.permissions),
    expiresAt: token.expiresAt,
    lastUsedAt: token.lastUsedAt,
    createdAt: token.createdAt,
  }));
}

// ============================================
// Token Validation (for API routes)
// ============================================

export interface ValidateTokenResult {
  success: true;
  projectId: number;
  projectName: string;
  permissions: string[];
}

export interface ValidateTokenInput {
  authHeader: string | null;
}

/**
 * Validate a bearer token from request headers
 */
export async function validateApiToken(
  authHeader: string | null
): Promise<
  | {
      success: true;
      data: ValidateTokenResult;
    }
  | {
      success: false;
      error: string;
    }
> {
  const token = parseBearerToken(authHeader);

  if (!token) {
    return { success: false, error: 'Missing or invalid Authorization header' };
  }

  const result = await validateToken(token);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: {
      projectId: result.project.id,
      projectName: result.project.name,
      permissions: JSON.parse(result.token.permissions),
    },
  };
}
