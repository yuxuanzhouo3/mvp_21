import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  loadChinaAccountProfile,
  loadIntlAccountProfile,
} from "@/lib/account/server-profile";
import { loginUser } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { assertSupabaseRuntimeEnv } from "@/lib/config/supabase-runtime";
import { accountLockout } from "@/lib/security/account-lockout";
import { logSecurityEvent } from "@/lib/utils/logger";

const chinaPhoneRegex = /^1[3-9]\d{9}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const loginSchema = z
  .object({
    identifier: z.string().trim().optional(),
    email: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    password: z.string().min(1, "Password is required"),
  })
  .superRefine((value, ctx) => {
    const identifier = value.identifier || value.email || value.phone;
    if (!identifier) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email or phone is required",
        path: ["identifier"],
      });
      return;
    }

    if (!emailRegex.test(identifier) && !chinaPhoneRegex.test(identifier)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid email or phone format",
        path: ["identifier"],
      });
    }
  });

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") || "unknown";
}

function createIntlAuthClient() {
  const env = assertSupabaseRuntimeEnv({
    context: "auth-login-intl",
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

function attachAuthCookies(
  response: NextResponse,
  accessToken: string,
  maxAgeSeconds: number,
) {
  response.cookies.set("auth-token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: maxAgeSeconds,
    path: "/",
  });
  response.cookies.set("auth_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: maxAgeSeconds,
    path: "/",
  });
}

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const clientIP = getClientIp(request);
    const validationResult = loginSchema.safeParse(body);

    if (!validationResult.success) {
      logSecurityEvent("login_validation_failed", undefined, clientIP, {
        errors: validationResult.error.errors,
      });
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { password } = validationResult.data;
    const loginIdentifierRaw =
      validationResult.data.identifier ||
      validationResult.data.email ||
      validationResult.data.phone ||
      "";
    const loginIdentifier = loginIdentifierRaw.trim();
    const loginWithPhone = chinaPhoneRegex.test(loginIdentifier);
    const normalizedLoginIdentifier = loginWithPhone
      ? loginIdentifier
      : loginIdentifier.toLowerCase();
    const lockoutKey = loginWithPhone
      ? `phone:${normalizedLoginIdentifier}`
      : normalizedLoginIdentifier;
    const lockoutStatus = accountLockout.isLocked(lockoutKey);
    if (lockoutStatus.locked) {
      logSecurityEvent("login_blocked_locked_account", undefined, clientIP, {
        identifier: lockoutKey,
      });
      return NextResponse.json(
        { error: "Account is temporarily locked" },
        { status: 429 },
      );
    }

    if (isChinaRegion()) {
      const userAgent = request.headers.get("user-agent") || undefined;
      const ipAddress = clientIP !== "unknown" ? clientIP : undefined;

      const result = await loginUser(normalizedLoginIdentifier, password, {
        deviceInfo: `${userAgent}`,
        ipAddress,
        userAgent,
      });

      if (!result.success || !result.userId) {
        accountLockout.recordFailedAttempt(lockoutKey, clientIP);
        logSecurityEvent("login_failed", undefined, clientIP, {
          identifier: lockoutKey,
        });
        return NextResponse.json(
          { error: result.error || "Login failed" },
          { status: 401 },
        );
      }

      const profile = await loadChinaAccountProfile(result.userId);
      accountLockout.recordSuccessfulLogin(lockoutKey);
      logSecurityEvent("login_success", result.userId, clientIP, {
        identifier: lockoutKey,
        identifierType: loginWithPhone ? "phone" : "email",
      });

      const response = NextResponse.json({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: profile || {
          id: result.userId,
          email: result.email || (loginWithPhone ? "" : normalizedLoginIdentifier),
          name: result.name || "",
          phone: result.phone || (loginWithPhone ? normalizedLoginIdentifier : ""),
          avatar: "",
          subscription_plan: "free",
          subscription_status: "inactive",
        },
        tokenMeta: result.tokenMeta,
      });

      if (result.accessToken) {
        attachAuthCookies(
          response,
          result.accessToken,
          result.tokenMeta?.accessTokenExpiresIn || 3600,
        );
      }

      return response;
    }

    if (loginWithPhone) {
      return NextResponse.json(
        { error: "Phone number login is only available in CN deployment" },
        { status: 400 },
      );
    }

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      return NextResponse.json(
        { error: "Supabase auth is not configured" },
        { status: 500 },
      );
    }

    const supabase = createIntlAuthClient();
    const {
      data: { session, user },
      error,
    } = await supabase.auth.signInWithPassword({
      email: normalizedLoginIdentifier,
      password,
    });

    if (error || !session || !user) {
      accountLockout.recordFailedAttempt(lockoutKey, clientIP);
      logSecurityEvent("login_failed", undefined, clientIP, {
        email: normalizedLoginIdentifier,
        region: "INTL",
        error: error?.message,
      });

      return NextResponse.json(
        { error: error?.message || "Login failed" },
        { status: 401 },
      );
    }

    const profile = await loadIntlAccountProfile(user.id, user);

    accountLockout.recordSuccessfulLogin(lockoutKey);
    logSecurityEvent("login_success", user.id, clientIP, {
      email: normalizedLoginIdentifier,
      region: "INTL",
    });

    const response = NextResponse.json({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      user: profile || {
          id: user.id,
          email: user.email || normalizedLoginIdentifier,
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
    });

    attachAuthCookies(response, session.access_token, session.expires_in || 3600);

    return response;
  } catch (error: any) {
    console.error("[/api/auth/login] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
