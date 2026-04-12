/**
 * 手机验证码登录 API
 * POST /api/auth/phone
 */

import { NextRequest, NextResponse } from "next/server";

import { verifyVerificationCode } from "@/lib/auth/verification-code-store";
import { loadChinaAccountProfile } from "@/lib/account/server-profile";
import { loginOrCreatePhoneUser } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";

export async function POST(request: NextRequest) {
  try {
    if (!isChinaRegion()) {
      return NextResponse.json(
        { success: false, error: { message: "国际站暂不支持手机号验证码登录" } },
        { status: 400 },
      );
    }

    const body = await request.json();
    const phone = String(body?.phone || "").trim();
    const code = String(body?.code || "").trim();

    if (!phone || !code) {
      return NextResponse.json(
        { success: false, error: { message: "请输入手机号和验证码" } },
        { status: 400 },
      );
    }

    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return NextResponse.json(
        { success: false, error: { message: "手机号格式不正确" } },
        { status: 400 },
      );
    }

    if (!verifyVerificationCode(phone, code)) {
      return NextResponse.json(
        { success: false, error: { message: "验证码错误或已过期" } },
        { status: 400 },
      );
    }

    const clientIP =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || undefined;

    const result = await loginOrCreatePhoneUser(phone, {
      deviceInfo: "phone-login",
      ipAddress: clientIP !== "unknown" ? clientIP : undefined,
      userAgent,
    });

    if (!result.success || !result.userId || !result.accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: { message: result.error || "登录失败，请稍后重试" },
        },
        { status: result.error === "账号已被禁用" ? 403 : 500 },
      );
    }

    const profile =
      (await loadChinaAccountProfile(result.userId)) || {
        id: result.userId,
        email: result.email || `phone_${phone}@local.phone`,
        name: result.name || `用户${phone.slice(-4)}`,
        phone,
        role: "user",
        subscription_plan: "free",
        subscription_status: "inactive",
      };

    const response = NextResponse.json({
      success: true,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      tokenMeta: result.tokenMeta,
      user: profile,
      token: result.accessToken,
      session: {
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
        user: profile,
      },
      data: {
        user: profile,
        token: result.accessToken,
        refreshToken: result.refreshToken,
      },
    });

    const maxAge = result.tokenMeta?.accessTokenExpiresIn || 3600;

    response.cookies.set("auth-token", result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });
    response.cookies.set("auth_token", result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("手机验证码登录失败:", error);
    return NextResponse.json(
      { success: false, error: { message: "登录失败，请重试" } },
      { status: 500 },
    );
  }
}
