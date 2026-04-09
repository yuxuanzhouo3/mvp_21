import { NextRequest, NextResponse } from 'next/server';

import { extractTokenFromHeader, verifyAuthToken } from '@/lib/auth/auth-utils';

export async function requireAuth(request: NextRequest): Promise<{
  user: any;
  session: any;
} | null> {
  try {
    const authHeader = request.headers.get('authorization');
    const { token } = extractTokenFromHeader(authHeader);
    if (!token) {
      console.error('[auth] Missing or invalid authorization header');
      return null;
    }

    const authResult = await verifyAuthToken(token);
    if (!authResult.success || !authResult.userId) {
      console.error('[auth] Token verification failed:', authResult.error);
      return null;
    }

    return {
      user: authResult.user || { id: authResult.userId },
      session: { access_token: token },
    };
  } catch (error) {
    console.error('[auth] Auth verification error:', error);
    return null;
  }
}

export function createAuthErrorResponse(message = 'Authentication required') {
  return NextResponse.json(
    { error: message, code: 'AUTH_REQUIRED' },
    { status: 401 },
  );
}
