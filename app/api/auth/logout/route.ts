import { NextRequest, NextResponse } from "next/server";

import { extractTokenFromRequest, verifyAuthToken } from "@/lib/auth/auth-utils";
import { revokeAllUserTokens } from "@/lib/auth/refresh-token-manager";
import { logSecurityEvent } from "@/lib/utils/logger";

function clearAuthCookies(response: NextResponse) {
  const secure = process.env.NODE_ENV === "production";
  const cookieOptions = {
    maxAge: 0,
    path: "/",
    sameSite: "lax" as const,
    secure,
  };

  response.cookies.set("auth-token", "", {
    ...cookieOptions,
    httpOnly: true,
  });
  response.cookies.set("auth_token", "", {
    ...cookieOptions,
    httpOnly: true,
  });
  response.cookies.set("access_token", "", {
    ...cookieOptions,
    httpOnly: true,
  });
  response.cookies.set("auth-logged-in", "", cookieOptions);
  response.cookies.set("auth-role", "", cookieOptions);
}

function buildLogoutResponse(payload: {
  success: boolean;
  message: string;
  tokensRevoked: number;
}) {
  const response = NextResponse.json(payload, { status: 200 });
  clearAuthCookies(response);
  return response;
}

export async function POST(request: NextRequest) {
  const clientIP =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";

  try {
    const { token } = extractTokenFromRequest(request);

    if (!token) {
      logSecurityEvent("logout_without_token", undefined, clientIP, {
        reason: "Missing token, cleared cookies only",
      });
      return buildLogoutResponse({
        success: true,
        message: "Logged out successfully",
        tokensRevoked: 0,
      });
    }

    const authResult = await verifyAuthToken(token);
    if (!authResult.success || !authResult.userId) {
      logSecurityEvent("logout_invalid_token", undefined, clientIP, {
        reason: authResult.error || "Invalid token",
      });
      return buildLogoutResponse({
        success: true,
        message: "Logged out successfully",
        tokensRevoked: 0,
      });
    }

    const userId = authResult.userId;
    const revokeResult = await revokeAllUserTokens(userId, "logout");

    if (!revokeResult.success) {
      logSecurityEvent("logout_revoke_failed", userId, clientIP, {
        error: revokeResult.error,
      });

      const response = NextResponse.json(
        { error: "Failed to revoke tokens" },
        { status: 500 },
      );
      clearAuthCookies(response);
      return response;
    }

    logSecurityEvent("logout_success", userId, clientIP, {
      tokensRevoked: revokeResult.revokedCount,
    });

    return buildLogoutResponse({
      success: true,
      message: "Logged out successfully",
      tokensRevoked: revokeResult.revokedCount || 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logSecurityEvent("logout_error", undefined, clientIP, { error: message });

    const response = NextResponse.json(
      {
        error: "Internal server error",
        details: message,
      },
      { status: 500 },
    );
    clearAuthCookies(response);
    return response;
  }
}
