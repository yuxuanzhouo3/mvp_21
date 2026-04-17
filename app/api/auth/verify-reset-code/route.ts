import bcrypt from "bcryptjs";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { CLOUDBASE_COLLECTIONS } from "@/lib/database/cloudbase-schema";
import { ensurePasswordResetCollections } from "@/lib/email/cloudbase-auth-collections";
import { verificationCodeService } from "@/lib/email/verification-code-service";

const schema = z.object({
  email: z.string().trim().email("邮箱格式不正确"),
  code: z.string().trim().length(6, "验证码必须是 6 位"),
});

export async function POST(request: NextRequest) {
  try {
    if (!isChinaRegion()) {
      return NextResponse.json(
        { error: "该接口仅在国内版可用" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validationResult = schema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors[0]?.message || "输入格式不正确" },
        { status: 400 },
      );
    }

    const email = validationResult.data.email.trim().toLowerCase();
    const code = validationResult.data.code.trim();

    const verifyResult = await verificationCodeService.verifyCode(
      email,
      code,
      "reset_password",
    );
    if (!verifyResult.success) {
      return NextResponse.json(
        { error: verifyResult.error || "验证码校验失败" },
        { status: 400 },
      );
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = await bcrypt.hash(resetToken, 10);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

    const db = getDatabase();
    await ensurePasswordResetCollections(db);
    await db.collection(CLOUDBASE_COLLECTIONS.PASSWORD_RESET_TOKENS).add({
      email,
      token: hashedToken,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      used: false,
    });

    return NextResponse.json({ resetToken });
  } catch (error) {
    console.error("[/api/auth/verify-reset-code] Error:", error);
    return NextResponse.json(
      { error: "服务暂时不可用，请稍后重试" },
      { status: 500 },
    );
  }
}

