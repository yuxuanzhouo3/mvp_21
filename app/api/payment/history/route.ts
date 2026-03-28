import { NextRequest, NextResponse } from "next/server";

import { requireAuth, createAuthErrorResponse } from "@/lib/auth/auth";
import { listPaymentsByUser } from "@/lib/data/billing-store";
import { apiRateLimit } from "@/lib/security/rate-limit";
import { logBusinessEvent, logError } from "@/lib/utils/logger";

// GET /api/payment/history?page=1&pageSize=20
export async function GET(request: NextRequest) {
  return new Promise<NextResponse>((resolve) => {
    const mockRes = {
      status: (code: number) => ({
        json: (data: unknown) => resolve(NextResponse.json(data, { status: code })),
      }),
      setHeader: () => {},
      getHeader: () => undefined,
    };

    apiRateLimit(request as any, mockRes as any, async () => {
      resolve(await handlePaymentHistory(request));
    });
  });
}

async function handlePaymentHistory(request: NextRequest) {
  const operationId = `payment_history_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 11)}`;

  try {
    const authResult = await requireAuth(request);
    if (!authResult) {
      return createAuthErrorResponse();
    }

    const userId = authResult.user.id;
    const { searchParams } = new URL(request.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSize = Math.min(
      Math.max(parseInt(searchParams.get("pageSize") || "20", 10), 1),
      100,
    );
    const offset = (page - 1) * pageSize;

    logBusinessEvent("payment_history_requested", userId, {
      operationId,
      page,
      pageSize,
      offset,
    });

    const { payments, total } = await listPaymentsByUser({
      userId,
      limit: pageSize,
      offset,
    });

    const records = payments.map((payment) => {
      const method = payment.paymentMethod.toLowerCase();
      const paymentMethod =
        method === "stripe"
          ? "Stripe"
          : method === "paypal"
            ? "PayPal"
            : method === "wechat"
              ? "WeChat Pay"
              : method === "alipay"
                ? "Alipay"
                : payment.paymentMethod;

      return {
        id: payment.id,
        date: payment.createdAt,
        amount: payment.amount,
        currency: payment.currency || "USD",
        status:
          payment.status === "completed"
            ? "paid"
            : payment.status,
        description: "Subscription payment",
        paymentMethod,
        invoiceUrl: null as string | null,
      };
    });

    logBusinessEvent("payment_history_returned", userId, {
      operationId,
      page,
      pageSize,
      total,
      recordCount: records.length,
    });

    return NextResponse.json({
      page,
      pageSize,
      count: records.length,
      total,
      records,
    });
  } catch (error) {
    logError(
      "payment_history_handler_error",
      error instanceof Error ? error : new Error(String(error)),
      {
        operationId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    );

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
