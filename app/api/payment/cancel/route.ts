import { NextRequest, NextResponse } from "next/server";

import { requireAuth, createAuthErrorResponse } from "@/lib/auth/auth";
import {
  applySubscriptionPaymentTerminalStatus,
  getPaymentRecordById,
} from "@/lib/payment/subscription-payment-sync";
import { paymentRateLimit } from "@/lib/security/rate-limit";
import { logBusinessEvent, logError, logSecurityEvent } from "@/lib/utils/logger";

export async function POST(request: NextRequest) {
  return new Promise<NextResponse>((resolve) => {
    const mockRes = {
      status: (code: number) => ({
        json: (data: any) => resolve(NextResponse.json(data, { status: code })),
      }),
      setHeader: () => {},
      getHeader: () => undefined,
    };

    paymentRateLimit(request as any, mockRes as any, async () => {
      resolve(await handlePaymentCancel(request));
    });
  });
}

async function handlePaymentCancel(request: NextRequest) {
  const operationId = `payment_cancel_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 11)}`;

  try {
    const authResult = await requireAuth(request);
    if (!authResult) {
      return createAuthErrorResponse();
    }

    const { user } = authResult;
    const body = await request.json();
    const paymentId = typeof body?.paymentId === "string" ? body.paymentId : "";

    if (!paymentId) {
      return NextResponse.json(
        { success: false, error: "Payment ID is required" },
        { status: 400 },
      );
    }

    const payment = await getPaymentRecordById(paymentId);
    if (!payment) {
      return NextResponse.json(
        { success: false, error: "Payment not found" },
        { status: 404 },
      );
    }

    if (payment.user_id !== user.id) {
      logSecurityEvent(
        "payment_cancel_forbidden",
        user.id,
        request.headers.get("x-forwarded-for") || "unknown",
        {
          operationId,
          paymentId,
          ownerId: payment.user_id,
        },
      );
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    if (payment.status !== "pending") {
      logBusinessEvent("payment_cancel_invalid_status", user.id, {
        operationId,
        paymentId,
        currentStatus: payment.status,
      });
      return NextResponse.json(
        { success: false, error: "Only pending payments can be cancelled" },
        { status: 400 },
      );
    }

    await applySubscriptionPaymentTerminalStatus({
      payment,
      paymentStatus: "failed",
    });

    logBusinessEvent("payment_cancel_success", user.id, {
      operationId,
      paymentId,
      amount: payment.amount,
      currency: payment.currency,
    });

    return NextResponse.json({
      success: true,
      message: "Payment cancelled successfully",
    });
  } catch (error) {
    logError(
      "payment_cancel_error",
      error instanceof Error ? error : new Error(String(error)),
      {
        operationId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    );

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
