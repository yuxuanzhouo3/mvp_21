import { NextRequest, NextResponse } from "next/server";

import {
  logAdminApiError,
  logAdminAudit,
  requireAdmin,
} from "@/lib/auth/admin-auth";
import { dispatchQueuedPaymentFailureNotifications } from "@/lib/payment/payment-failure-dispatcher";

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if ("error" in admin) {
    return admin.error;
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      id?: string;
      limit?: number;
    };

    const result = await dispatchQueuedPaymentFailureNotifications({
      id: typeof body.id === "string" ? body.id : undefined,
      limit:
        typeof body.limit === "number" && Number.isFinite(body.limit)
          ? Math.min(Math.max(body.limit, 1), 20)
          : 10,
    });

    logAdminAudit("Admin payment failure notification dispatch triggered", admin.auditContext, {
      result,
      targetNotificationId: body.id,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logAdminApiError(
      "Failed to dispatch payment failure notifications",
      error,
      admin.auditContext,
    );
    return NextResponse.json(
      {
        success: false,
        error: "Failed to dispatch payment failure notifications",
      },
      { status: 500 },
    );
  }
}
