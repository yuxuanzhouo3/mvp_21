/**
 * Backward-compatible auth endpoint for legacy clients.
 * Prefer using `/api/auth/login` and `/api/auth/register` for new code.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { loginUser, signupUser } from "@/lib/cloudbase/cloudbase-service";

interface LegacyAuthRequestBody {
  action?: "login" | "signup" | string;
  identifier?: string;
  email?: string;
  phone?: string;
  password?: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function resolveAccountIdentifier(body: LegacyAuthRequestBody) {
  return String(body.identifier || body.phone || body.email || "").trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LegacyAuthRequestBody;
    const action = body.action || "login";
    const password = String(body.password || "");
    const account = resolveAccountIdentifier(body);

    if (!account || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing account identifier or password",
        },
        { status: 400 },
      );
    }

    const clientIP =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || undefined;

    if (action === "login") {
      const result = await loginUser(account, password, {
        deviceInfo: "web-login",
        ipAddress: clientIP,
        userAgent,
      });

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            message: result.error || "Login failed",
          },
          { status: 401 },
        );
      }

      return NextResponse.json({
        success: true,
        user: {
          id: result.userId,
          email: result.email,
          phone: result.phone,
          name: result.name,
        },
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        tokenMeta: result.tokenMeta,
        token: result.accessToken,
      });
    }

    if (action === "signup") {
      if (!emailRegex.test(account)) {
        return NextResponse.json(
          {
            success: false,
            message: "Signup only supports email registration",
          },
          { status: 400 },
        );
      }

      const result = await signupUser(account, password, {
        deviceInfo: "web-signup",
        ipAddress: clientIP,
        userAgent,
      });

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            message: result.error || "Signup failed",
          },
          { status: 400 },
        );
      }

      return NextResponse.json({
        success: true,
        user: {
          id: result.userId,
          email: account.includes("@") ? account : undefined,
          phone: /^\d{11}$/.test(account) ? account : undefined,
          name: account.includes("@") ? account.split("@")[0] : account,
        },
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        tokenMeta: result.tokenMeta,
        token: result.accessToken,
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: "Unsupported action",
      },
      { status: 400 },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Server error",
      },
      { status: 500 },
    );
  }
}
