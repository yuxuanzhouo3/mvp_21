import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  loadChinaAccountProfile,
  loadIntlAccountProfile,
} from "@/lib/account/server-profile";
import {
  createRefreshToken,
  verifyRefreshToken,
} from "@/lib/auth/refresh-token-manager";
import { signJwt } from "@/lib/auth/jwt";
import { isChinaRegion } from "@/lib/config/region";
import { assertSupabaseRuntimeEnv } from "@/lib/config/supabase-runtime";
import { logSecurityEvent } from "@/lib/utils/logger";

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

function attachAuthCookies(
  response: NextResponse,
  accessToken: string,
  maxAgeSeconds: number,
) {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: maxAgeSeconds,
    path: "/",
  };

  response.cookies.set("auth-token", accessToken, cookieOptions);
  response.cookies.set("auth_token", accessToken, cookieOptions);
}

function clearAuthTokenCookies(response: NextResponse) {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 0,
    path: "/",
  };

  response.cookies.set("auth-token", "", cookieOptions);
  response.cookies.set("auth_token", "", cookieOptions);
  response.cookies.set("access_token", "", cookieOptions);
}

function createIntlAuthClient() {
  const env = assertSupabaseRuntimeEnv({
    context: "auth-refresh-intl",
  });

  if (!env.url || !env.anonKey) {
    throw new Error("Supabase auth is not configured");
  }

  return createClient(
    env.url,
    env.anonKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
}

async function refreshTokenForChina(
  refreshToken: string,
  clientIP: string,
  userAgent?: string,
) {
  try {
    const tokenResult = await verifyRefreshToken(refreshToken);

    if (!tokenResult.valid || !tokenResult.userId || !tokenResult.email) {
      return {
        success: false,
        error: tokenResult.error || "Refresh token is invalid or expired",
        status: 401,
      };
    }

    const { userId, email } = tokenResult;
    const newAccessToken = signJwt(
      {
        userId,
        email,
        region: "CN",
      },
      {
        expiresIn: "1h",
      },
    );

    const newTokenRecord = await createRefreshToken({
      userId,
      email,
      deviceInfo: "web-refresh",
      ipAddress: clientIP,
      userAgent,
    });

    if (!newTokenRecord) {
      return {
        success: false,
        error: "Failed to create new refresh token",
        status: 500,
      };
    }

    const profile = await loadChinaAccountProfile(userId);

    return {
      success: true,
      accessToken: newAccessToken,
      refreshToken: newTokenRecord.refreshToken,
      user:
        profile || {
          id: userId,
          email,
          name: "",
          avatar: "",
          subscription_plan: "free",
          subscription_status: "inactive",
        },
      tokenMeta: {
        accessTokenExpiresIn: 3600,
        refreshTokenExpiresIn: 604800,
      },
      status: 200,
    };
  } catch (error: any) {
    console.error("[/api/auth/refresh] CN error:", error.message);
    return {
      success: false,
      error: error.message || "Token refresh failed",
      status: error.status || 500,
    };
  }
}

async function refreshTokenForIntl(refreshToken: string) {
  try {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      return {
        success: false,
        error: "Supabase auth is not configured",
        status: 500,
      };
    }

    const supabase = createIntlAuthClient();
    const {
      data: { session, user },
      error,
    } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !session || !user) {
      return {
        success: false,
        error: error?.message || "Refresh token is invalid or expired",
        status: 401,
      };
    }

    const profile = await loadIntlAccountProfile(user.id, user);

    return {
      success: true,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      user:
        profile || {
          id: user.id,
          email: user.email || "",
          name:
            user.user_metadata?.displayName ||
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            "",
          avatar: user.user_metadata?.avatar || user.user_metadata?.avatar_url || "",
          subscription_plan: user.user_metadata?.subscription_plan || "free",
          subscription_status: user.user_metadata?.subscription_status || "inactive",
          membership_expires_at: user.user_metadata?.membership_expires_at,
        },
      tokenMeta: {
        accessTokenExpiresIn: session.expires_in || 3600,
        refreshTokenExpiresIn: 604800,
      },
      status: 200,
    };
  } catch (error: any) {
    console.error("[/api/auth/refresh] INTL error:", error);
    return {
      success: false,
      error: error?.message || "Token refresh failed",
      status: 500,
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const clientIP =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || undefined;

    const validationResult = refreshSchema.safeParse(body);
    if (!validationResult.success) {
      logSecurityEvent("token_refresh_validation_failed", undefined, clientIP, {
        errors: validationResult.error.errors,
      });

      return NextResponse.json(
        {
          error: "Invalid input",
          details: validationResult.error.errors,
        },
        { status: 400 },
      );
    }

    const { refreshToken } = validationResult.data;
    const result = isChinaRegion()
      ? await refreshTokenForChina(refreshToken, clientIP, userAgent)
      : await refreshTokenForIntl(refreshToken);

    if (!result.success) {
      logSecurityEvent("token_refresh_failed", undefined, clientIP, {
        error: result.error,
        region: isChinaRegion() ? "CN" : "INTL",
      });

      const response = NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
      if (result.status === 401) {
        clearAuthTokenCookies(response);
      }
      return response;
    }

    logSecurityEvent("token_refresh_success", result.user?.id, clientIP, {
      region: isChinaRegion() ? "CN" : "INTL",
    });

    const { success, status, ...responseData } = result;
    const response = NextResponse.json(responseData, { status });
    if (result.accessToken) {
      attachAuthCookies(
        response,
        result.accessToken,
        result.tokenMeta?.accessTokenExpiresIn || 3600,
      );
    }
    return response;
  } catch (error: any) {
    console.error("[/api/auth/refresh] Error:", error);
    logSecurityEvent(
      "token_refresh_error",
      undefined,
      request.headers.get("x-forwarded-for") || "unknown",
      {
        error: error.message,
      },
    );

    return NextResponse.json(
      {
        error: "Internal server error",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
