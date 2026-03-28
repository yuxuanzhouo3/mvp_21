/**
 * Shared authentication helpers for CN and INTL deployments.
 *
 * CN uses CloudBase JWT verification and loads the current user from `web_users`.
 * INTL uses Supabase auth to resolve the current user from the bearer token.
 */

import cloudbase from '@cloudbase/node-sdk';
import * as jwt from 'jsonwebtoken';

import { isChinaRegion } from '@/lib/config/region';
import { supabase } from '@/lib/integrations/supabase';
import { isTokenExpired, normalizeTokenPayload } from '@/lib/utils/token-normalizer';

let cachedApp: any = null;

function getCloudBaseApp() {
  if (cachedApp) {
    return cachedApp;
  }

  cachedApp = cloudbase.init({
    env: process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID,
    secretId: process.env.CLOUDBASE_SECRET_ID,
    secretKey: process.env.CLOUDBASE_SECRET_KEY,
  });

  return cachedApp;
}

export async function verifyAuthToken(token: string): Promise<{
  success: boolean;
  userId?: string;
  user?: any;
  error?: string;
  region?: 'CN' | 'INTL';
}> {
  if (!token) {
    return { success: false, error: 'Missing token' };
  }

  try {
    const region = isChinaRegion() ? 'CN' : 'INTL';

    if (region === 'CN') {
      let payload: any;

      try {
        payload = jwt.verify(
          token,
          process.env.JWT_SECRET || 'fallback-secret-key-for-development-only',
        );
      } catch (error) {
        console.error('[Auth Utils] JWT verification failed:', error);
        return {
          success: false,
          error: 'Invalid token signature or token expired',
          region,
        };
      }

      const userId = payload.userId;
      if (!userId) {
        return { success: false, error: 'Invalid token payload', region };
      }

      try {
        const normalized = normalizeTokenPayload(payload, region);
        if (isTokenExpired(normalized)) {
          return { success: false, error: 'Token expired', region };
        }
      } catch (error) {
        console.warn('[Auth Utils] Failed to normalize token payload:', error);
      }

      const db = getCloudBaseApp().database();
      const result = await db.collection('web_users').doc(userId).get();

      if (!result.data || result.data.length === 0) {
        return { success: false, error: 'User not found', region };
      }

      return {
        success: true,
        userId,
        user: {
          id: userId,
          ...result.data[0],
        },
        region,
      };
    }

    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (error || !user) {
        return { success: false, error: 'Invalid Supabase token', region };
      }

      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          const normalized = normalizeTokenPayload(payload, region);

          if (isTokenExpired(normalized)) {
            return { success: false, error: 'Token expired', region };
          }
        }
      } catch (error) {
        console.warn('[Auth Utils] Failed to parse INTL token payload:', error);
      }

      return {
        success: true,
        userId: user.id,
        user,
        region,
      };
    } catch (error) {
      console.error('[Auth Utils] Supabase auth error:', error);
      return {
        success: false,
        error: 'Supabase authentication failed',
        region,
      };
    }
  } catch (error) {
    console.error('[Auth Utils] Token verification error:', error);
    return { success: false, error: 'Token verification failed' };
  }
}

export function extractTokenFromHeader(authHeader: string | null): {
  token: string | null;
  error: string | null;
} {
  if (!authHeader) {
    return { token: null, error: 'Missing authorization header' };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return { token: null, error: 'Invalid authorization header format' };
  }

  return {
    token: authHeader.replace('Bearer ', ''),
    error: null,
  };
}

export function getDatabase() {
  if (isChinaRegion()) {
    return getCloudBaseApp().database();
  }

  return supabase;
}
