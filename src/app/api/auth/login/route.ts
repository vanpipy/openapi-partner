import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateUser, createSession, getSessionCookieOptions } from '@/lib/auth';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = loginSchema.parse(body);

    const result = await authenticateUser(username, password);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    // Create session
    const sessionId = await createSession(result.user.id);
    const maxAge = parseInt(process.env.SESSION_MAX_AGE || '86400');

    const response = NextResponse.json({
      success: true,
      user: {
        id: result.user.id,
        username: result.user.username,
        role: result.user.role,
      },
    });

    // Set session cookie
    response.cookies.set('session_id', sessionId, getSessionCookieOptions(maxAge));

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
