import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import {
  CLOUDBASE_COLLECTIONS,
  type PasswordResetTokenRecord,
} from "@/lib/database/cloudbase-schema";
import { ensurePasswordResetCollections } from "@/lib/email/cloudbase-auth-collections";

const schema = z
  .object({
    email: z.string().trim().email("邮箱格式不正确"),
    resetToken: z.string().trim().min(1, "重置令牌不能为空"),
    password: z.string().min(6, "密码至少需要 6 位"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  });

async function updateUserPasswordByEmail(email: string, hashedPassword: string) {
  const db = getDatabase();
  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date().toISOString();

  let result = await db
    .collection(CLOUDBASE_COLLECTIONS.WEB_USERS)
    .where({ email: normalizedEmail })
    .update({
      password: hashedPassword,
      updated_at: now,
      updatedAt: now,
    });

  if (!result?.updated && normalizedEmail !== email) {
    result = await db
      .collection(CLOUDBASE_COLLECTIONS.WEB_USERS)
      .where({ email })
      .update({
        password: hashedPassword,
        updated_at: now,
        updatedAt: now,
      });
  }

  return result;
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
        { error: validationResult.error.errors[0]?.message || "输入格式不正确" },
        { status: 400 },
      );
    }

    const email = validationResult.data.email.trim();
    const normalizedEmail = email.toLowerCase();
    const resetToken = validationResult.data.resetToken.trim();
    const password = validationResult.data.password;
    const db = getDatabase();
    await ensurePasswordResetCollections(db);
    const now = new Date().toISOString();

    const tokenResult = await db
      .collection(CLOUDBASE_COLLECTIONS.PASSWORD_RESET_TOKENS)
      .where({
        email: normalizedEmail,
        used: false,
        expires_at: db.command.gte(now),
      })
      .orderBy("created_at", "desc")
      .limit(1)
      .get();

    if (!tokenResult.data?.length) {
      return NextResponse.json(
        { error: "重置令牌无效或已过期" },
        { status: 400 },
      );
    }

    const tokenRecord = tokenResult.data[0] as PasswordResetTokenRecord;
    if (!tokenRecord._id) {
      return NextResponse.json(
        { error: "重置令牌无效" },
        { status: 400 },
      );
    }

    const isTokenValid = await bcrypt.compare(resetToken, tokenRecord.token);
    if (!isTokenValid) {
      return NextResponse.json(
        { error: "重置令牌无效" },
        { status: 400 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const updateResult = await updateUserPasswordByEmail(email, hashedPassword);

    if (!updateResult?.updated) {
      return NextResponse.json(
        { error: "用户不存在或密码更新失败" },
        { status: 400 },
      );
    }

    await db
      .collection(CLOUDBASE_COLLECTIONS.PASSWORD_RESET_TOKENS)
      .doc(tokenRecord._id)
      .update({
        used: true,
        used_at: now,
      });

    return NextResponse.json({ message: "密码重置成功" });
  } catch (error) {
    console.error("[/api/auth/reset-password] Error:", error);
    return NextResponse.json(
      { error: "服务暂时不可用，请稍后重试" },
      { status: 500 },
    );
  }
}

