import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  loadChinaAccountProfile,
  loadIntlAccountProfile,
} from "@/lib/account/server-profile";
import { loginUser } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { accountLockout } from "@/lib/security/account-lockout";
import { logSecurityEvent } from "@/lib/utils/logger";

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

function createIntlAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key",
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
    const body = await request.json();
    const clientIP = request.headers.get("x-forwarded-for") || "unknown";
    const validationResult = loginSchema.safeParse(body);

    if (!validationResult.success) {
      logSecurityEvent("login_validation_failed", undefined, clientIP, {
        errors: validationResult.error.errors,
      });
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { email, password } = validationResult.data;
    const lockoutStatus = accountLockout.isLocked(email);
    if (lockoutStatus.locked) {
      logSecurityEvent("login_blocked_locked_account", undefined, clientIP, {
        email,
      });
      return NextResponse.json(
        { error: "Account is temporarily locked" },
        { status: 429 },
      );
    }

    if (isChinaRegion()) {
      const userAgent = request.headers.get("user-agent") || undefined;
      const ipAddress = clientIP !== "unknown" ? clientIP : undefined;

      const result = await loginUser(email, password, {
        deviceInfo: `${userAgent}`,
        ipAddress,
        userAgent,
      });

      if (!result.success || !result.userId) {
        accountLockout.recordFailedAttempt(email, clientIP);
        logSecurityEvent("login_failed", undefined, clientIP, { email });
        return NextResponse.json(
          { error: result.error || "Login failed" },
          { status: 401 },
        );
      }

      const profile = await loadChinaAccountProfile(result.userId);
      accountLockout.recordSuccessfulLogin(email);
      logSecurityEvent("login_success", result.userId, clientIP, { email });

      return NextResponse.json({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: profile || {
          id: result.userId,
          email: result.email || email,
          name: result.name || "",
          avatar: "",
          subscription_plan: "free",
          subscription_status: "inactive",
        },
        tokenMeta: result.tokenMeta,
      });
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
      email,
      password,
    });

    if (error || !session || !user) {
      accountLockout.recordFailedAttempt(email, clientIP);
      logSecurityEvent("login_failed", undefined, clientIP, {
        email,
        region: "INTL",
        error: error?.message,
      });

      return NextResponse.json(
        { error: error?.message || "Login failed" },
        { status: 401 },
      );
    }

    const profile = await loadIntlAccountProfile(user.id, user);

    accountLockout.recordSuccessfulLogin(email);
    logSecurityEvent("login_success", user.id, clientIP, {
      email,
      region: "INTL",
    });

    return NextResponse.json({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      user: profile || {
        id: user.id,
        email: user.email || email,
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
  } catch (error: any) {
    console.error("[/api/auth/login] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
