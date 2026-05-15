import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { eq } from 'drizzle-orm';
import { initDatabase, users, sessions, UserRole, type User, type Session } from './db';

/**
 * Session-based authentication library
 * Simple and secure for single-application use
 */

// Session cookie configuration
const SESSION_COOKIE_NAME = 'session_id';
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

/**
 * Hash a password using scrypt
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = scryptSync(password, salt, 64).toString('hex');
  
  try {
    const hashBuffer = Buffer.from(hash, 'hex');
    const verifyBuffer = Buffer.from(verifyHash, 'hex');
    return timingSafeEqual(hashBuffer, verifyBuffer);
  } catch {
    return false;
  }
}

/**
 * Generate a secure session ID
 */
export function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Create a new session for a user
 */
export async function createSession(userId: number, maxAge: number = 86400): Promise<string> {
  const { db } = initDatabase();
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + maxAge * 1000);

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
  });

  return sessionId;
}

/**
 * Get session by session ID
 */
export async function getSession(sessionId: string): Promise<{ session: Session; user: User } | null> {
  const { db } = initDatabase();

  const result = await db
    .select()
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId))
    .get();

  if (!result) return null;

  // Check if session is expired
  if (new Date(result.sessions.expiresAt) < new Date()) {
    // Delete expired session
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  return {
    session: result.sessions,
    user: result.users,
  };
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const { db } = initDatabase();
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/**
 * Delete all sessions for a user
 */
export async function deleteUserSessions(userId: number): Promise<void> {
  const { db } = initDatabase();
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * Authenticate user with username and password
 */
export async function authenticateUser(
  username: string,
  password: string
): Promise<{ success: true; user: User } | { success: false; error: string }> {
  const { db } = initDatabase();

  const user = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .get();

  if (!user) {
    return { success: false, error: 'Invalid username or password' };
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return { success: false, error: 'Invalid username or password' };
  }

  return { success: true, user };
}

/**
 * Create a new user
 */
export async function createUser(
  username: string,
  password: string,
  role: UserRole = UserRole.VIEWER
): Promise<{ success: true; user: User } | { success: false; error: string }> {
  const { db } = initDatabase();

  // Check if username exists
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .get();

  if (existing) {
    return { success: false, error: 'Username already exists' };
  }

  const passwordHash = hashPassword(password);
  const now = new Date();

  const result = await db
    .insert(users)
    .values({
      username,
      passwordHash,
      role,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  return { success: true, user: result };
}

/**
 * Get session cookie options for response headers
 */
export function getSessionCookieOptions(maxAge: number = 86400) {
  return {
    ...SESSION_COOKIE_OPTIONS,
    maxAge,
  };
}

/**
 * Parse session cookie from request headers
 */
export function parseSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, value] = cookie.split('=');
    if (name === SESSION_COOKIE_NAME) {
      return value;
    }
  }
  return null;
}

/**
 * Role-based permission check
 */
export function hasPermission(role: UserRole, action: string): boolean {
  const permissions: Record<UserRole, string[]> = {
    [UserRole.VIEWER]: ['read'],
    [UserRole.EDITOR]: ['read', 'create', 'update'],
    [UserRole.ADMIN]: ['read', 'create', 'update', 'delete', 'manage_users'],
  };

  return permissions[role]?.includes(action) ?? false;
}

// Export constants
export { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS };
