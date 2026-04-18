// app/api/payment/create/route.ts - Payment creation API route
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth, createAuthErrorResponse } from "@/lib/auth/auth";
import { AlipayProvider } from "@/lib/architecture-modules/layers/third-party/payment/providers/alipay-provider";
import { StripeProvider } from "@/lib/architecture-modules/layers/third-party/payment/providers/stripe-provider";
import { WechatProviderV3 } from "@/lib/architecture-modules/layers/third-party/payment/providers/wechat-provider-v3";
import { getPaymentMethodStatus } from "@/lib/config/third-party-capabilities";
import {
  getAppUrl,
  getWechatPayApiV3Key,
  getWechatPayAppId,
  getWechatPayMerchantId,
  getWechatPayPrivateKey,
  getWechatPaySerialNo,
} from "@/lib/config/runtime-env";
import { captureException } from "@/lib/integrations/sentry";
import { getPricingByMethod, type PaymentMethod } from "@/lib/payment/payment-config";
import {
  createPendingPaymentRecord,
  findRecentPaymentByFingerprint,
} from "@/lib/payment/payment-record-store";
import { buildSubscriptionPaymentFields } from "@/lib/payment/subscription-payment-sync";
import { paymentRateLimit } from "@/lib/security/rate-limit";

// Validate payment creation payloads from the client.
const createPaymentSchema = z.object({
  method: z.enum(["stripe", "alipay", "wechat"]),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().min(1, "Currency is required").transform((value) => value.toUpperCase()),
  description: z.string().optional(),
  planType: z.string().optional(),
  billingCycle: z.enum(["monthly", "yearly"]).optional(),
  idempotencyKey: z.string().optional(),
});

/**
 * POST /api/payment/create
 * Create a new payment order after auth and rate-limit checks.
 */
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
      resolve(await handlePaymentCreate(request));
    });
  });
}

async function handlePaymentCreate(request: NextRequest) {
  try {
    // Ensure the caller is authenticated.
    const authResult = await requireAuth(request);
    if (!authResult) {
      return createAuthErrorResponse();
    }

    const { user } = authResult;

    // Validate the request body before touching payment state.
    const body = await request.json();
    const validationResult = createPaymentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid input",
          code: "VALIDATION_ERROR",
          details: validationResult.error.errors,
        },
        { status: 400 },
      );
    }

    const {
      method,
      amount,
      currency,
      description,
      planType,
      billingCycle,
      idempotencyKey,
    } = validationResult.data;
    const paymentMethod = method as PaymentMethod;
    const resolvedBillingCycle = billingCycle || "monthly";

    const pricing = getPricingByMethod(paymentMethod);
    const expectedAmount = pricing[resolvedBillingCycle];
    const expectedCurrency = pricing.currency;

    const roundedClientAmount = Math.round(amount * 100) / 100;
    const roundedExpectedAmount = Math.round(expectedAmount * 100) / 100;
    if (
      roundedClientAmount !== roundedExpectedAmount ||
      currency !== expectedCurrency
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Submitted pricing does not match the current plan configuration.",
          code: "PRICE_MISMATCH",
          expected: {
            amount: roundedExpectedAmount,
            currency: expectedCurrency,
            billingCycle: resolvedBillingCycle,
          },
        },
        { status: 400 },
      );
    }

    const userId = user.id;
    const methodStatus = getPaymentMethodStatus(
      paymentMethod,
    );

    if (!methodStatus.enabled) {
      return NextResponse.json(
        {
          success: false,
          error:
            methodStatus.reason ||
            "Payment method is not available in this environment.",
          code: "PAYMENT_METHOD_UNAVAILABLE",
        },
        { status: 503 },
      );
    }

    // Block repeated create requests that arrive within a short window.
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    let recentPayment: {
      id?: string;
      _id?: string;
      status?: string;
      created_at?: string;
      createdAt?: string;
    } | null = null;

    try {
      recentPayment = await findRecentPaymentByFingerprint({
        userId,
        amount: roundedExpectedAmount,
        currency: expectedCurrency,
        paymentMethod,
        sinceIso: oneMinuteAgo,
      });
    } catch (checkError) {
      console.error("Error checking existing payment:", checkError);
      return NextResponse.json(
        {
          success: false,
          error: "Unable to verify payment uniqueness, please try again",
        },
        { status: 500 },
      );
    }

    if (recentPayment) {
      const recentCreatedAt =
        recentPayment.created_at || recentPayment.createdAt || new Date().toISOString();
      const paymentAge =
        Date.now() -
        new Date(recentCreatedAt).getTime();

      console.warn(
        `Duplicate payment request blocked: User ${userId} tried to create payment within ${Math.floor(
          paymentAge / 1000,
        )}s of existing payment ${recentPayment.id || recentPayment._id} (status: ${recentPayment.status})`,
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "You have a recent payment request. Please wait a moment before trying again.",
          code: "DUPLICATE_PAYMENT_REQUEST",
          existingPaymentId: recentPayment.id || recentPayment._id,
          waitTime: Math.ceil((60000 - paymentAge) / 1000),
        },
        { status: 429 },
      );
    }

    // Derive normalized billing metadata for downstream persistence.
    const paymentFields = buildSubscriptionPaymentFields({
      planType: planType || "pro",
      billingCycle: resolvedBillingCycle,
    });

    const order = {
      amount: roundedExpectedAmount,
      currency: expectedCurrency,
      description:
        description ||
        `${resolvedBillingCycle === "monthly" ? "1 Month" : "1 Year"} Premium Membership`,
      userId,
      planType: paymentFields.metadata.planType,
      billingCycle: paymentFields.metadata.billingCycle,
      method: paymentMethod,
    };

    let orderResult: {
      orderId: string;
      paymentUrl?: string;
      formHtml?: string;
      codeUrl?: string;
      transactionId?: string;
    };

    if (paymentMethod === "stripe") {
      const provider = new StripeProvider(process.env);
      const created = await provider.createOnetimePayment(order);

      if (!created.success || !created.paymentId) {
        throw new Error(created.error || "Failed to create Stripe payment");
      }

      orderResult = {
        orderId: created.paymentId,
        paymentUrl: created.paymentUrl,
        transactionId: created.paymentId,
      };
    } else if (paymentMethod === "alipay") {
      const provider = new AlipayProvider(process.env);
      const created = await provider.createPayment(order);

      if (!created.success || !created.paymentId) {
        throw new Error(created.error || "Failed to create Alipay payment");
      }

      orderResult = {
        orderId: created.paymentId,
        paymentUrl: created.paymentUrl,
        formHtml: created.paymentUrl,
        transactionId: created.paymentId,
      };
    } else if (paymentMethod === "wechat") {
      const outTradeNo = `WX${Date.now()}${Math.random()
        .toString(36)
        .slice(2, 7)
        .toUpperCase()}`;
      const provider = new WechatProviderV3({
        appId: getWechatPayAppId(),
        mchId: getWechatPayMerchantId(),
        apiV3Key: getWechatPayApiV3Key(),
        privateKey: getWechatPayPrivateKey(),
        serialNo: getWechatPaySerialNo(),
        notifyUrl: `${getAppUrl()}/api/payment/webhook/wechat`,
      });

      const created = await provider.createNativePayment({
        out_trade_no: outTradeNo,
        amount: Math.round(amount * 100),
        description: order.description,
      });

      orderResult = {
        orderId: outTradeNo,
        paymentUrl: created.codeUrl,
        codeUrl: created.codeUrl,
        transactionId: outTradeNo,
      };
    } else {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported payment method: ${paymentMethod}`,
        },
        { status: 400 },
      );
    }

    // Persist the pending payment record in the region-specific store.
    const nowIso = new Date().toISOString();
    try {
      await createPendingPaymentRecord({
        userId,
        amount: roundedExpectedAmount,
        currency: expectedCurrency,
        paymentMethod,
        orderId: orderResult.orderId,
        transactionId: orderResult.transactionId || orderResult.orderId,
        codeUrl: orderResult.codeUrl,
        nowIso,
        paymentFields,
        clientType: paymentMethod === "wechat" ? "native" : undefined,
      });
      console.log("Payment recorded with metadata:", {
        transactionId: orderResult.orderId,
        metadata: paymentFields.metadata,
      });
    } catch (paymentRecordError) {
      console.error("Error recording payment:", paymentRecordError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to record payment",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      paymentId: orderResult.orderId,
      paymentUrl: orderResult.formHtml || orderResult.paymentUrl,
      codeUrl: orderResult.codeUrl,
      data: {
        orderId: orderResult.orderId,
        paymentId: orderResult.orderId,
        paymentUrl: orderResult.formHtml || orderResult.paymentUrl,
        codeUrl: orderResult.codeUrl,
        method: order.method,
        amount: order.amount,
        currency: order.currency,
        description: order.description,
        planType: order.planType,
        billingCycle: order.billingCycle,
        idempotencyKey,
      },
    });
  } catch (error) {
    console.error("Payment create error:", error);
    captureException(error as Error);
    const errorMessage =
      error instanceof Error && error.message
        ? error.message
        : "Failed to create payment";

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}
