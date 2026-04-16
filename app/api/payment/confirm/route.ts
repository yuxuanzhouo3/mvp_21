import { NextRequest, NextResponse } from "next/server";

import { AlipayProvider } from "@/lib/architecture-modules/layers/third-party/payment/providers/alipay-provider";
import { StripeProvider } from "@/lib/architecture-modules/layers/third-party/payment/providers/stripe-provider";
import { WechatProviderV3 } from "@/lib/architecture-modules/layers/third-party/payment/providers/wechat-provider-v3";
import { requireAuth, createAuthErrorResponse } from "@/lib/auth/auth";
import {
  getAppUrl,
  getWechatPayApiV3Key,
  getWechatPayAppId,
} from "@/lib/config/runtime-env";
import {
  applySubscriptionPaymentSuccess,
  getPaymentRecordById,
  getPaymentRecordForUserByReference,
} from "@/lib/payment/subscription-payment-sync";
import { observeOperationalMetric } from "@/lib/monitoring/operational-observability";
import { paymentRateLimit } from "@/lib/security/rate-limit";
import { logBusinessEvent, logError, logSecurityEvent } from "@/lib/utils/logger";

type PaymentConfirmationResult = {
  success: boolean;
  transactionId: string;
  amount: number;
  currency: string;
  providerReference?: string;
};

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
      resolve(await handlePaymentConfirm(request));
    });
  });
}

async function confirmPaymentWithProvider(
  payment: any,
  reference: string,
): Promise<PaymentConfirmationResult> {
  const method = payment.payment_method;

  if (method === "stripe") {
    const provider = new StripeProvider(process.env);
    const confirmation = await provider.confirmPayment(reference);
    return {
      ...confirmation,
      providerReference: reference,
    };
  }

  if (method === "alipay") {
    const provider = new AlipayProvider(process.env);
    const confirmation = await provider.confirmPayment(reference);
    const queryResult = await provider.queryPayment(reference);
    return {
      ...confirmation,
      success:
        queryResult.trade_status === "TRADE_SUCCESS" ||
        queryResult.trade_status === "TRADE_FINISHED",
      providerReference: reference,
    };
  }

  if (method === "wechat") {
    const provider = new WechatProviderV3({
      appId: getWechatPayAppId(),
      mchId: process.env.WECHAT_PAY_MCH_ID!,
      apiV3Key: getWechatPayApiV3Key(),
      privateKey: process.env.WECHAT_PAY_PRIVATE_KEY!,
      serialNo: process.env.WECHAT_PAY_SERIAL_NO!,
      notifyUrl: `${getAppUrl()}/api/payment/webhook/wechat`,
    });
    const result = await provider.queryOrderByOutTradeNo(reference);

    return {
      success: result.tradeState === "SUCCESS",
      transactionId: result.transactionId || reference,
      amount: result.amount ? result.amount / 100 : payment.amount || 0,
      currency: payment.currency || "CNY",
      providerReference: reference,
    };
  }

  throw new Error("Unsupported payment method");
}

async function handlePaymentConfirm(request: NextRequest) {
  const operationId = `payment_confirm_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 11)}`;
  const startedAt = Date.now();
  const observe = (
    outcome: "success" | "failure" | "rejected",
    statusCode: number,
    meta?: Record<string, unknown>,
    userId?: string,
  ) => {
    observeOperationalMetric({
      chain: "payment_confirm",
      outcome,
      statusCode,
      operationId,
      userId,
      durationMs: Date.now() - startedAt,
      metadata: meta,
    });
  };

  try {
    const authResult = await requireAuth(request);
    if (!authResult) {
      observe("rejected", 401, { reason: "auth_required" });
      return createAuthErrorResponse();
    }

    const { user } = authResult;
    const body = await request.json();

    const rawReferences = [
      typeof body?.paymentId === "string" ? body.paymentId : "",
      typeof body?.subscriptionId === "string" ? body.subscriptionId : "",
    ].filter(Boolean);

    if (!rawReferences.length) {
      observe("rejected", 400, { reason: "missing_reference" }, user.id);
      return NextResponse.json(
        { success: false, error: "Missing required payment reference" },
        { status: 400 },
      );
    }

    let payment = null as any;

    if (typeof body?.paymentId === "string" && body.paymentId) {
      payment = await getPaymentRecordById(body.paymentId);
    }

    if (!payment) {
      for (const reference of rawReferences) {
        payment = await getPaymentRecordForUserByReference(user.id, reference);
        if (payment) {
          break;
        }
      }
    }

    if (!payment) {
      logBusinessEvent("payment_confirm_not_found", user.id, {
        operationId,
        references: rawReferences,
      });
      observe(
        "rejected",
        404,
        { reason: "payment_not_found", references: rawReferences },
        user.id,
      );
      return NextResponse.json(
        { success: false, error: "Payment record not found" },
        { status: 404 },
      );
    }

    if (payment.user_id !== user.id) {
      logSecurityEvent(
        "payment_confirm_forbidden",
        user.id,
        request.headers.get("x-forwarded-for") || "unknown",
        {
          operationId,
          paymentOwnerId: payment.user_id,
          references: rawReferences,
        },
      );
      observe(
        "rejected",
        403,
        { reason: "forbidden", paymentOwnerId: payment.user_id, references: rawReferences },
        user.id,
      );
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    if (payment.status === "completed" && payment.subscription_id) {
      logBusinessEvent("payment_confirm_idempotent_replay", user.id, {
        operationId,
        paymentId: payment.id || payment._id,
        subscriptionId: payment.subscription_id,
        transactionId:
          payment.transaction_id || payment.order_id || payment.out_trade_no,
      });
      observe(
        "success",
        200,
        {
          reason: "idempotent_replay",
          paymentId: payment.id || payment._id,
          subscriptionId: payment.subscription_id,
        },
        user.id,
      );

      return NextResponse.json({
        success: true,
        transactionId:
          payment.transaction_id || payment.order_id || payment.out_trade_no,
        amount: payment.amount,
        currency: payment.currency,
        subscription: {
          id: payment.subscription_id,
          planId:
            payment.metadata?.planType ||
            payment.plan_id ||
            (payment.product_type !== "subscription" ? payment.product_type : undefined),
          status: "active",
          billingCycle: payment.billing_cycle || payment.metadata?.billingCycle,
        },
      });
    }

    const reference =
      rawReferences.find((item) => item === payment.transaction_id) ||
      payment.out_trade_no ||
      payment.transaction_id ||
      rawReferences[0];

    logBusinessEvent("payment_confirm_started", user.id, {
      operationId,
      paymentId: payment.id || payment._id,
      reference,
      method: payment.payment_method,
      status: payment.status,
    });

    const confirmation = await confirmPaymentWithProvider(payment, reference);

    if (!confirmation.success) {
      logBusinessEvent("payment_confirm_provider_rejected", user.id, {
        operationId,
        paymentId: payment.id || payment._id,
        reference,
        method: payment.payment_method,
      });
      observe(
        "rejected",
        400,
        {
          reason: "provider_rejected",
          paymentId: payment.id || payment._id,
          reference,
          method: payment.payment_method,
        },
        user.id,
      );
      return NextResponse.json(
        { success: false, error: "Payment confirmation failed" },
        { status: 400 },
      );
    }

    const syncResult = await applySubscriptionPaymentSuccess({
      payment,
      finalTransactionId: confirmation.transactionId,
      providerReference: confirmation.providerReference || reference,
      amount: confirmation.amount || payment.amount,
      currency: confirmation.currency || payment.currency,
      paymentMethod: payment.payment_method,
    });

    logBusinessEvent("payment_confirm_success", user.id, {
      operationId,
      paymentId: syncResult.paymentId,
      subscriptionId: syncResult.subscriptionId,
      method: payment.payment_method,
      transactionId: confirmation.transactionId,
      planType: syncResult.metadata.planType,
      billingCycle: syncResult.metadata.billingCycle,
    });
    observe(
      "success",
      200,
      {
        reason: "confirmed",
        paymentId: syncResult.paymentId,
        subscriptionId: syncResult.subscriptionId,
        method: payment.payment_method,
      },
      user.id,
    );

    return NextResponse.json({
      success: true,
      transactionId: confirmation.transactionId,
      amount: confirmation.amount || payment.amount,
      currency: confirmation.currency || payment.currency,
      subscription: {
        id: syncResult.subscriptionId,
        planId: syncResult.metadata.planType,
        status: "active",
        billingCycle: syncResult.metadata.billingCycle,
      },
    });
  } catch (error) {
    observe("failure", 500, {
      reason: "exception",
      error: error instanceof Error ? error.message : String(error),
    });
    logError(
      "payment_confirm_error",
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
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
