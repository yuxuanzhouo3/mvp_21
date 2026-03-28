import { NextRequest, NextResponse } from 'next/server';

import { isChinaRegion } from '../config/region';
import { supabase } from '../integrations/supabase';

export async function requireAuth(request: NextRequest): Promise<{
  user: any;
  session: any;
} | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[auth] Missing or invalid authorization header');
      return null;
    }

    const token = authHeader.substring(7);

    if (isChinaRegion()) {
      try {
        const internalBaseUrl =
          process.env.APP_URL ||
          process.env.NEXT_PUBLIC_APP_URL ||
          request.nextUrl.origin ||
          'http://localhost:3000';

        const response = await fetch(`${internalBaseUrl}/api/auth/me`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.error('[auth] CloudBase auth verification failed:', response.status);
          return null;
        }

        const data = await response.json();
        if (!data.success || !data.user) {
          console.error('[auth] CloudBase auth verification returned invalid data');
          return null;
        }

        return {
          user: data.user,
          session: { access_token: token },
        };
      } catch (error) {
        console.error('[auth] CloudBase auth verification error:', error);
        return null;
      }
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('[auth] Invalid token or user not found:', error?.message);
      return null;
    }

    return {
      user,
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
