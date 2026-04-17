import bcrypt from "bcryptjs";
import crypto from "crypto";

import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import {
  CLOUDBASE_COLLECTIONS,
  type EmailVerificationCodeRecord,
} from "@/lib/database/cloudbase-schema";
import { ensureCloudbaseCollection } from "@/lib/email/cloudbase-auth-collections";

type VerificationCodeType = "register" | "reset_password";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export class VerificationCodeService {
  generateCode(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  async createCode(
    email: string,
    type: VerificationCodeType,
    ipAddress?: string,
  ): Promise<{ success: boolean; code?: string; error?: string }> {
    try {
      const normalizedEmail = normalizeEmail(email);
      const rateLimit = await this.checkRateLimit(normalizedEmail, type);
      if (!rateLimit.allowed) {
        return { success: false, error: rateLimit.error };
      }

      const code = this.generateCode();
      const hashedCode = await bcrypt.hash(code, 10);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

      const db = getDatabase();
      await ensureCloudbaseCollection(
        db,
        CLOUDBASE_COLLECTIONS.EMAIL_VERIFICATION_CODES,
      );
      await db.collection(CLOUDBASE_COLLECTIONS.EMAIL_VERIFICATION_CODES).add({
        email: normalizedEmail,
        code: hashedCode,
        type,
        attempts: 0,
        ip_address: ipAddress,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        verified: false,
      });

      return { success: true, code };
    } catch (error) {
      console.error("[VerificationCodeService] Failed to create code:", error);
      return { success: false, error: "创建验证码失败" };
    }
  }

  async verifyCode(
    email: string,
    code: string,
    type: VerificationCodeType,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const normalizedEmail = normalizeEmail(email);
      const db = getDatabase();
      await ensureCloudbaseCollection(
        db,
        CLOUDBASE_COLLECTIONS.EMAIL_VERIFICATION_CODES,
      );
      const now = new Date().toISOString();

      const result = await db
        .collection(CLOUDBASE_COLLECTIONS.EMAIL_VERIFICATION_CODES)
        .where({
          email: normalizedEmail,
          type,
          verified: false,
          expires_at: db.command.gte(now),
        })
        .orderBy("created_at", "desc")
        .limit(1)
        .get();

      if (!result.data?.length) {
        return { success: false, error: "验证码不存在或已过期" };
      }

      const record = result.data[0] as EmailVerificationCodeRecord;
      if (record.attempts >= 5) {
        return { success: false, error: "验证码尝试次数过多，请重新获取" };
      }

      const recordId = record._id;
      if (!recordId) {
        return { success: false, error: "验证码记录异常，请重新获取" };
      }

      await db
        .collection(CLOUDBASE_COLLECTIONS.EMAIL_VERIFICATION_CODES)
        .doc(recordId)
        .update({
          attempts: record.attempts + 1,
        });

      const isValid = await bcrypt.compare(code.trim(), record.code);
      if (!isValid) {
        return { success: false, error: "验证码错误" };
      }

      await db
        .collection(CLOUDBASE_COLLECTIONS.EMAIL_VERIFICATION_CODES)
        .doc(recordId)
        .update({
          verified: true,
          verified_at: new Date().toISOString(),
        });

      return { success: true };
    } catch (error) {
      console.error("[VerificationCodeService] Failed to verify code:", error);
      return { success: false, error: "验证码校验失败" };
    }
  }

  private async checkRateLimit(
    email: string,
    type: VerificationCodeType,
  ): Promise<{ allowed: boolean; error?: string }> {
    try {
      const db = getDatabase();
      await ensureCloudbaseCollection(
        db,
        CLOUDBASE_COLLECTIONS.EMAIL_VERIFICATION_CODES,
      );
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
      const result = await db
        .collection(CLOUDBASE_COLLECTIONS.EMAIL_VERIFICATION_CODES)
        .where({
          email,
          type,
          created_at: db.command.gte(oneMinuteAgo),
        })
        .get();

      if (result.data?.length) {
        return { allowed: false, error: "发送过于频繁，请稍后再试" };
      }

      return { allowed: true };
    } catch (error) {
      console.error("[VerificationCodeService] Failed to check rate limit:", error);
      return { allowed: false, error: "发送失败，请稍后再试" };
    }
  }
}

export const verificationCodeService = new VerificationCodeService();

