/**
 * Middleware for request handling
 * Token-based authentication for API routes
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { parseBearerToken, validateToken } from '@/lib/auth';

// Paths that don't require authentication
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/api/health',
];

// Paths that require token authentication
const PROTECTED_PATHS = [
  '/api/',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  // Check if path requires authentication
  const requiresAuth = PROTECTED_PATHS.some((path) => pathname.startsWith(path));

  if (!requiresAuth) {
    return NextResponse.next();
  }

  // Get Authorization header
  const authHeader = request.headers.get('Authorization');
  const token = parseBearerToken(authHeader);

  if (!token) {
    return NextResponse.json(
      { error: 'Missing or invalid Authorization header' },
      { status: 401 }
    );
  }

  // Validate token
  const result = await validateToken(token);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 401 }
    );
  }

  // Add project info to request headers for downstream use
  const headers = new Headers(request.headers);
  headers.set('x-project-id', result.project.id.toString());
  headers.set('x-project-name', result.project.name);
  headers.set('x-token-permissions', result.token.permissions);

  // Continue with modified request
  return NextResponse.next({
    request: {
      headers,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
