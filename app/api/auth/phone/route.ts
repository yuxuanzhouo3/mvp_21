/**
 * 手机验证码登录 API
 * POST /api/auth/phone
 */

import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";

import {
  verifyVerificationCode,
} from "@/lib/auth/verification-code-store";
import { getDb, TABLES } from "@/lib/db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "contracthub-secret-key-change-in-production",
);

async function generateToken(user: any): Promise<string> {
  return new SignJWT({
    sub: user.id,
    phone: user.phone,
    role: user.role || "user",
    plan: user.plan || "free",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(user.plan === "free" ? "30d" : "90d")
    .sign(JWT_SECRET);
}

function verifyCode(phone: string, code: string) {
  return verifyVerificationCode(phone, code, { allowAnyInDevelopment: true });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, code } = body;

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

    if (!verifyCode(phone, code)) {
      return NextResponse.json(
        { success: false, error: { message: "验证码错误或已过期" } },
        { status: 400 },
      );
    }

    const db = getDb();
    let user = await db.findOne<any>(TABLES.USERS, { phone });

    if (!user) {
      user = await db.create(TABLES.USERS, {
        phone,
        name: `用户${phone.slice(-4)}`,
        role: "user",
        plan: "free",
        status: "active",
        contracts_count: 0,
        contracts_this_month: 0,
      });
      console.log(`手机号用户自动注册: ${phone}`);
    }

    if (user.status !== "active") {
      return NextResponse.json(
        { success: false, error: { message: "账号已被禁用" } },
        { status: 403 },
      );
    }

    await db.update(TABLES.USERS, user.id, {
      last_login_at: new Date().toISOString(),
    });

    const token = await generateToken(user);

    await db.create(TABLES.USER_SESSIONS, {
      user_id: user.id,
      token,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
      user_agent: request.headers.get("user-agent") || "unknown",
    });

    const { password_hash, ...safeUser } = user;

    const response = NextResponse.json({
      success: true,
      data: {
        user: safeUser,
        token,
      },
    });

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
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
