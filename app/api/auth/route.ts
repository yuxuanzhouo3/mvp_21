/**
 * Backward-compatible auth endpoint for legacy clients.
 * Prefer using `/api/auth/login` and `/api/auth/register` for new code.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { loginUser, signupUser } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { assertSupabaseRuntimeEnv } from "@/lib/config/supabase-runtime";

interface LegacyAuthRequestBody {
  action?: "login" | "signup" | string;
  identifier?: string;
  email?: string;
  phone?: string;
  password?: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const chinaPhoneRegex = /^1[3-9]\d{9}$/;

function resolveAccountIdentifier(body: LegacyAuthRequestBody) {
  return String(body.identifier || body.phone || body.email || "").trim();
}

function createIntlAuthClient() {
  const env = assertSupabaseRuntimeEnv({
    context: "legacy-auth-route-intl",
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

    const isCn = isChinaRegion();

    if (action === "login") {
      if (isCn) {
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

      if (chinaPhoneRegex.test(account)) {
        return NextResponse.json(
          {
            success: false,
            message: "Phone number login is only available in CN deployment",
          },
          { status: 400 },
        );
      }

      const normalizedEmail = account.toLowerCase();
      const supabase = createIntlAuthClient();
      const {
        data: { session, user },
        error,
      } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error || !session || !user) {
        return NextResponse.json(
          {
            success: false,
            message: error?.message || "Login failed",
          },
          { status: 401 },
        );
      }

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email || normalizedEmail,
          phone: undefined,
          name:
            user.user_metadata?.displayName ||
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            normalizedEmail.split("@")[0] ||
            "",
        },
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        tokenMeta: {
          accessTokenExpiresIn: session.expires_in || 3600,
          refreshTokenExpiresIn: 604800,
        },
        token: session.access_token,
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

      if (isCn) {
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

      const normalizedEmail = account.toLowerCase();
      const supabase = createIntlAuthClient();
      const {
        data: { session, user },
        error,
      } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            name: normalizedEmail.split("@")[0] || "User",
            full_name: normalizedEmail.split("@")[0] || "User",
            displayName: normalizedEmail.split("@")[0] || "User",
          },
        },
      });

      if (error) {
        return NextResponse.json(
          {
            success: false,
            message: error.message || "Signup failed",
          },
          { status: 400 },
        );
      }

      return NextResponse.json({
        success: true,
        user: {
          id: user?.id,
          email: user?.email || normalizedEmail,
          phone: undefined,
          name:
            user?.user_metadata?.displayName ||
            user?.user_metadata?.full_name ||
            user?.user_metadata?.name ||
            normalizedEmail.split("@")[0] ||
            "User",
        },
        accessToken: session?.access_token || null,
        refreshToken: session?.refresh_token || null,
        tokenMeta: session
          ? {
              accessTokenExpiresIn: session.expires_in || 3600,
              refreshTokenExpiresIn: 604800,
            }
          : null,
        token: session?.access_token || null,
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
