import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { CLOUDBASE_COLLECTIONS } from "@/lib/database/cloudbase-schema";
import { emailService } from "@/lib/email/email-service";
import { getPasswordResetTemplate } from "@/lib/email/templates";
import { verificationCodeService } from "@/lib/email/verification-code-service";

const schema = z.object({
  email: z.string().trim().email("邮箱格式不正确"),
});

const GENERIC_SUCCESS_MESSAGE = "如果该邮箱已注册，验证码将发送到邮箱";

async function findUserByEmail(email: string) {
  const db = getDatabase();
  const normalizedEmail = email.trim().toLowerCase();

  const normalizedResult = await db
    .collection(CLOUDBASE_COLLECTIONS.WEB_USERS)
    .where({ email: normalizedEmail })
    .limit(1)
    .get();

  if (normalizedResult.data?.length) {
    return normalizedResult.data[0] as { email?: string };
  }

  if (normalizedEmail !== email) {
    const rawResult = await db
      .collection(CLOUDBASE_COLLECTIONS.WEB_USERS)
      .where({ email })
      .limit(1)
      .get();
    if (rawResult.data?.length) {
      return rawResult.data[0] as { email?: string };
    }
  }

  return null;
}

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
        {
          error:
            validationResult.error.errors[0]?.message || "输入格式不正确",
        },
        { status: 400 },
      );
    }

    const email = validationResult.data.email.trim();
    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE });
    }

    const clientIP =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      undefined;

    const result = await verificationCodeService.createCode(
      email,
      "reset_password",
      clientIP,
    );
    if (!result.success || !result.code) {
      const shouldThrottle =
        typeof result.error === "string" && result.error.includes("频繁");
      return NextResponse.json(
        { error: result.error || "发送验证码失败" },
        { status: shouldThrottle ? 429 : 500 },
      );
    }

    await emailService.sendEmail(
      email.toLowerCase(),
      "密码重置验证码",
      getPasswordResetTemplate(result.code),
    );

    return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE });
  } catch (error) {
    console.error("[/api/auth/send-reset-code] Error:", error);
    return NextResponse.json(
      { error: "服务暂时不可用，请稍后重试" },
      { status: 500 },
    );
  }
}

