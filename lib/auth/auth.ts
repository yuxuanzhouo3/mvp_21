import { NextRequest, NextResponse } from 'next/server';

import { extractTokenFromRequest, verifyAuthToken } from '@/lib/auth/auth-utils';

export async function requireAuth(request: NextRequest): Promise<{
  user: any;
  session: any;
} | null> {
  try {
    const { token } = extractTokenFromRequest(request);
    if (!token) {
      console.error('[auth] Missing authentication token');
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
