import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  logAdminApiError,
  logAdminAudit,
  requireAdmin,
  type AdminAuditContext,
} from "@/lib/auth/admin-auth";
import { accountLockout } from "@/lib/security/account-lockout";
import { logSecurityEvent } from "@/lib/utils/logger";

const unlockSchema = z.object({
  email: z.string().email("Invalid email format"),
  reason: z.string().min(1, "Reason is required"),
});

export async function POST(request: NextRequest) {
  let auditContext: AdminAuditContext | undefined;

  try {
    const admin = await requireAdmin(request);
    if ("error" in admin) {
      return admin.error;
    }

    auditContext = admin.auditContext;
    const body = await request.json();
    const clientIP =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const validationResult = unlockSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          code: "VALIDATION_ERROR",
          details: validationResult.error.errors,
        },
        { status: 400 },
      );
    }

    const { email, reason } = validationResult.data;
    const beforeStatus = accountLockout.getAccountStatus(email);
    const wasLocked = accountLockout.isLocked(email).locked;

    if (!wasLocked) {
      return NextResponse.json(
        {
          error: "Account is not locked",
          code: "ACCOUNT_NOT_LOCKED",
        },
        { status: 400 },
      );
    }

    const unlocked = accountLockout.unlockAccount(email);

    if (!unlocked) {
      return NextResponse.json(
        {
          error: "Failed to unlock account",
          code: "UNLOCK_FAILED",
        },
        { status: 500 },
      );
    }

    logSecurityEvent("account_unlocked", admin.userId, clientIP, {
      targetEmail: email,
      reason,
      adminUserId: admin.userId,
      previousFailedAttempts: beforeStatus.failedAttempts,
      previousProgressiveLevel: beforeStatus.progressiveLevel,
    });
    logAdminAudit("Admin unlocked a locked account", auditContext, {
      targetEmail: email,
    });

    return NextResponse.json({
      success: true,
      message: "Account unlocked successfully",
      email,
      unlockedAt: new Date().toISOString(),
    });
  } catch (error) {
    logAdminApiError("Failed to unlock account", error, auditContext, {
      action: "auth.unlock",
    });
    logSecurityEvent(
      "account_unlock_error",
      auditContext?.actorUserId,
      request.headers.get("x-forwarded-for") || "unknown",
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    );

    return NextResponse.json(
      {
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      },
      { status: 500 },
    );
  }
}
