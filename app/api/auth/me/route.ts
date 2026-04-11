import { NextRequest, NextResponse } from "next/server";

import {
  loadChinaAccountProfile,
  loadIntlAccountProfile,
} from "@/lib/account/server-profile";
import { extractTokenFromRequest, verifyAuthToken } from "@/lib/auth/auth-utils";
import { isChinaRegion } from "@/lib/config/region";
import { logSecurityEvent } from "@/lib/utils/logger";

function getRequestToken(request: NextRequest) {
  const { token, error } = extractTokenFromRequest(request);
  return { token, error };
}

export async function GET(request: NextRequest) {
  try {
    const clientIP =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const { token, error: tokenError } = getRequestToken(request);

    if (tokenError || !token) {
      return NextResponse.json(
        {
          error: tokenError || "No authentication token",
          code: "NO_AUTH_TOKEN",
        },
        { status: 401 },
      );
    }

    const authResult = await verifyAuthToken(token);
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json(
        {
          error: authResult.error || "Invalid or expired token",
          code: "INVALID_TOKEN",
        },
        { status: 401 },
      );
    }

    const profile = isChinaRegion()
      ? await loadChinaAccountProfile(authResult.userId)
      : await loadIntlAccountProfile(
          authResult.userId,
          authResult.user && "user_metadata" in authResult.user
            ? authResult.user
            : undefined,
        );

    if (!profile) {
      return NextResponse.json(
        {
          error: "User not found",
          code: "USER_NOT_FOUND",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      user: profile,
      region: isChinaRegion() ? "CN" : "INTL",
    });
  } catch (error) {
    console.error("[/api/auth/me] Error:", error);
    logSecurityEvent(
      "get_user_error",
      undefined,
      request.headers.get("x-forwarded-for") || "unknown",
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    );

    return NextResponse.json(
      {
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      },
      { status: 500 },
    );
  }
}
