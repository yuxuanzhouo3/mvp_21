import { NextRequest, NextResponse } from "next/server";

import { AlipayProvider } from "@/lib/architecture-modules/layers/third-party/payment/providers/alipay-provider";
import { StripeProvider } from "@/lib/architecture-modules/layers/third-party/payment/providers/stripe-provider";
import { WechatProviderV3 } from "@/lib/architecture-modules/layers/third-party/payment/providers/wechat-provider-v3";
import { requireAuth, createAuthErrorResponse } from "@/lib/auth/auth";
import { isChinaRegion } from "@/lib/config/region";
import {
  getAppUrl,
  getWechatPayApiV3Key,
  getWechatPayAppId,
} from "@/lib/config/runtime-env";
import {
  extractSubscriptionOrderMetadata,
  getPaymentRecordById,
  updatePaymentRecordFields,
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
      resolve(await handlePaymentContinue(request));
    });
  });
}

async function createFreshPaymentSession(payment: any) {
  const metadata = extractSubscriptionOrderMetadata(payment);
  const recordId = payment.id || payment._id || payment.transaction_id;
  const order = {
    amount: payment.amount,
    currency: payment.currency || (isChinaRegion() ? "CNY" : "USD"),
    description:
      payment.product_name || `Continue payment for order ${recordId}`,
    userId: payment.user_id,
    planType: metadata.planType,
    billingCycle: metadata.billingCycle,
  };

  if (payment.payment_method === "stripe") {
    const provider = new StripeProvider(process.env);
    return provider.createPayment(order);
  }

  if (payment.payment_method === "alipay") {
    const provider = new AlipayProvider(process.env);
    return provider.createPayment(order);
  }

  if (payment.payment_method === "wechat") {
    const outTradeNo =
      payment.out_trade_no ||
      payment.transaction_id ||
      `WX${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const provider = new WechatProviderV3({
      appId: getWechatPayAppId(),
      mchId: process.env.WECHAT_PAY_MCH_ID || "",
      apiV3Key: getWechatPayApiV3Key(),
      privateKey: process.env.WECHAT_PAY_PRIVATE_KEY || "",
      serialNo: process.env.WECHAT_PAY_SERIAL_NO || "",
      notifyUrl: `${getAppUrl()}/api/payment/webhook/wechat`,
    });

    const wechatResult = await provider.createNativePayment({
      out_trade_no: outTradeNo,
      amount: Math.round(Number(payment.amount) * 100),
      description: order.description,
    });

    return {
      success: true,
      paymentId: outTradeNo,
      paymentUrl: wechatResult.codeUrl,
      codeUrl: wechatResult.codeUrl,
      transactionId: outTradeNo,
    };
  }

  throw new Error("Unsupported payment method");
}

async function handlePaymentContinue(request: NextRequest) {
  const operationId = `payment_continue_${Date.now()}_${Math.random()
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
      logBusinessEvent("payment_continue_not_found", user.id, {
        operationId,
        paymentId,
      });
      return NextResponse.json(
        { success: false, error: "Payment not found" },
        { status: 404 },
      );
    }

    if (payment.user_id !== user.id) {
      logSecurityEvent(
        "payment_continue_forbidden",
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
      logBusinessEvent("payment_continue_invalid_status", user.id, {
        operationId,
        paymentId,
        currentStatus: payment.status,
      });
      return NextResponse.json(
        { success: false, error: "Only pending payments can be continued" },
        { status: 400 },
      );
    }

    let metadata;
    try {
      metadata = extractSubscriptionOrderMetadata(payment);
    } catch (error) {
      logError(
        "payment_continue_missing_order_metadata",
        error instanceof Error ? error : new Error(String(error)),
        {
          operationId,
          paymentId,
          userId: user.id,
        },
      );
      return NextResponse.json(
        {
          success: false,
          error: "Payment order metadata is incomplete, please recreate the order",
          code: "PAYMENT_METADATA_MISSING",
        },
        { status: 409 },
      );
    }

    const createdAt = new Date(payment.created_at || Date.now());
    const minutesDiff = (Date.now() - createdAt.getTime()) / (1000 * 60);
    const shouldRefreshSession =
      minutesDiff > 30 ||
      payment.payment_method === "stripe" ||
      payment.payment_method === "alipay" ||
      (payment.payment_method === "wechat" && !payment.code_url);

    logBusinessEvent("payment_continue_requested", user.id, {
      operationId,
      paymentId,
      method: payment.payment_method,
      minutesDiff,
      shouldRefreshSession,
      billingCycle: metadata.billingCycle,
      planType: metadata.planType,
    });

    if (!shouldRefreshSession && payment.payment_method === "wechat") {
      return NextResponse.json({
        success: true,
        paymentUrl: payment.code_url,
        paymentId: payment.out_trade_no || payment.transaction_id,
      });
    }

    const refreshedSession = await createFreshPaymentSession(payment);

    if (!refreshedSession.success || !refreshedSession.paymentId) {
      const refreshedError =
        "error" in refreshedSession ? refreshedSession.error : undefined;
      throw new Error(refreshedError || "Failed to create payment session");
    }

    const nextTransactionId = refreshedSession.paymentId;
    const updatePayload: Record<string, unknown> = {
      transaction_id: nextTransactionId,
      order_id: nextTransactionId,
      updated_at: new Date().toISOString(),
      metadata: {
        ...(payment.metadata || {}),
        ...metadata,
      },
    };

    if (payment.payment_method === "alipay" || payment.payment_method === "wechat") {
      updatePayload.out_trade_no = nextTransactionId;
    }

    await updatePaymentRecordFields(paymentId, updatePayload);

    return NextResponse.json({
      success: true,
      paymentUrl: refreshedSession.paymentUrl,
      paymentId: nextTransactionId,
    });
  } catch (error) {
    logError(
      "payment_continue_error",
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
