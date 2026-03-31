/**
 * 发送短信验证码 API
 * POST /api/auth/sms/send
 */

import { NextRequest, NextResponse } from "next/server";

import {
  getVerificationCode,
  setVerificationCode,
  verifyVerificationCode,
} from "@/lib/auth/verification-code-store";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json(
        { success: false, error: { message: "请输入手机号" } },
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

    const existing = getVerificationCode(phone);
    if (existing && existing.expiresAt - Date.now() > 4 * 60 * 1000) {
      return NextResponse.json(
        { success: false, error: { message: "发送过于频繁，请稍后再试" } },
        { status: 429 },
      );
    }

    const code = generateCode();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    setVerificationCode(phone, { code, expiresAt });

    console.log(`短信验证码已发送到 ${phone}: ${code}`);

    return NextResponse.json({
      success: true,
      data: {
        message: "验证码已发送",
        ...(process.env.NODE_ENV === "development" ? { code } : {}),
      },
    });
  } catch (error) {
    console.error("发送验证码失败:", error);
    return NextResponse.json(
      { success: false, error: { message: "发送失败，请重试" } },
      { status: 500 },
    );
  }
}
