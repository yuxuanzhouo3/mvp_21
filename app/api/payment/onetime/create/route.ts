// app/api/payment/onetime/create/route.ts - 涓€娆℃€ф敮浠樺垱寤篈PI
import { NextRequest, NextResponse } from "next/server";
import { StripeProvider } from "@/lib/architecture-modules/layers/third-party/payment/providers/stripe-provider";
import { AlipayProvider } from "@/lib/architecture-modules/layers/third-party/payment/providers/alipay-provider";
import { WechatProviderV3 } from "@/lib/architecture-modules/layers/third-party/payment/providers/wechat-provider-v3";
import { requireAuth, createAuthErrorResponse } from "@/lib/auth/auth";
import { getPaymentMethodStatus } from "@/lib/config/third-party-capabilities";
import {
  getAppUrl,
  getWechatPayApiV3Key,
  getWechatPayAppId,
  getWechatPayMerchantId,
  getWechatPayPrivateKey,
  getWechatPaySerialNo,
} from "@/lib/config/runtime-env";
import { paymentRateLimit } from "@/lib/security/rate-limit";
import { captureException } from "@/lib/integrations/sentry";
import { logInfo, logError, logWarn } from "@/lib/utils/logger";
import {
  getDaysByBillingCycle,
} from "@/lib/payment/payment-config";
import type { PaymentMethod, BillingCycle } from "@/lib/payment/payment-config";
import { getRuntimePricingByMethod } from "@/lib/pricing/runtime";
import {
  createPendingPaymentRecord,
  findRecentPaymentByFingerprint,
  type PaymentRecordLike,
} from "@/lib/payment/payment-record-store";
import { buildSubscriptionPaymentFields } from "@/lib/payment/subscription-payment-sync";

type CreatedPaymentResult = {
  success: boolean;
  paymentId?: string;
  paymentUrl?: string;
  codeUrl?: string;
  transactionId?: string;
  error?: string;
};

export async function POST(request: NextRequest) {
  // 搴旂敤閫熺巼闄愬埗
  return new Promise<NextResponse>((resolve) => {
    const mockRes = {
      status: (code: number) => ({
        json: (data: any) => resolve(NextResponse.json(data, { status: code })),
      }),
      setHeader: () => { },
      getHeader: () => undefined,
    };

    paymentRateLimit(request as any, mockRes as any, async () => {
      resolve(await handleOnetimePaymentCreate(request));
    });
  });
}

async function handleOnetimePaymentCreate(request: NextRequest) {
  const startTime = Date.now();
  const operationId = `onetime_create_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  try {
    // 楠岃瘉鐢ㄦ埛璁よ瘉
    const authResult = await requireAuth(request);
    if (!authResult) {
      return createAuthErrorResponse();
    }

    const { user } = authResult;
    const body = await request.json();
    const { method, billingCycle } = body as {
      method: PaymentMethod;
      billingCycle: BillingCycle;
    };

    logInfo("Creating one-time payment", {
      operationId,
      userId: user.id,
      method,
      billingCycle,
    });

    // 楠岃瘉蹇呴渶鍙傛暟
    if (!method || !billingCycle) {
      logWarn("Missing required parameters", {
        operationId,
        userId: user.id,
        method,
        billingCycle,
      });
      return NextResponse.json(
        { success: false, error: "Missing payment method or billing cycle" },
        { status: 400 }
      );
    }

    // 楠岃瘉 billingCycle
    if (!["monthly", "yearly"].includes(billingCycle)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid billing cycle. Must be 'monthly' or 'yearly'",
        },
        { status: 400 }
      );
    }

    const methodStatus = getPaymentMethodStatus(method);
    if (!methodStatus.enabled) {
      logWarn("Payment method unavailable due to configuration", {
        operationId,
        userId: user.id,
        method,
        reason: methodStatus.reason,
      });
      return NextResponse.json(
        {
          success: false,
          error:
            methodStatus.reason ||
            "Payment method is not available in this environment.",
          code: "PAYMENT_METHOD_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    // 浣跨敤缁熶竴鐨勬敮浠橀厤缃幏鍙栬揣甯佸拰閲戦
    const pricing = await getRuntimePricingByMethod(method, "pro");
    const currency = pricing.currency;
    const amount = pricing[billingCycle];
    const days = getDaysByBillingCycle(billingCycle);

    // 妫€鏌ユ渶锟?鍒嗛挓鍐呮槸鍚︽湁鐩稿悓鐨刾ending鎴朿ompleted鏀粯(闃叉閲嶅鐐瑰嚮)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    let recentPayment: PaymentRecordLike | null = null;

    try {
      recentPayment = await findRecentPaymentByFingerprint({
        userId: user.id,
        amount,
        currency,
        paymentMethod: method,
        sinceIso: oneMinuteAgo,
      });
    } catch (checkError) {
      logError(
        "Error checking existing payment",
        checkError instanceof Error
          ? checkError
          : new Error(String(checkError)),
        {
        operationId,
        userId: user.id,
        }
      );
      return NextResponse.json(
        {
          success: false,
          error: "Unable to verify payment uniqueness, please try again",
        },
        { status: 500 }
      );
    }

    if (recentPayment) {
      const latestPayment = recentPayment;
      const recentCreatedAt =
        latestPayment.created_at || latestPayment.createdAt || new Date().toISOString();
      const paymentAge =
        Date.now() - new Date(recentCreatedAt).getTime();

      logWarn("Duplicate payment request blocked", {
        operationId,
        userId: user.id,
        existingPaymentId: latestPayment.id || latestPayment._id,
        paymentAge: `${Math.floor(paymentAge / 1000)}s`,
      });

      return NextResponse.json(
        {
          success: false,
          error:
            "You have a recent payment request. Please wait a moment before trying again.",
          code: "DUPLICATE_PAYMENT_REQUEST",
          existingPaymentId: latestPayment.id || latestPayment._id,
          waitTime: Math.ceil((60000 - paymentAge) / 1000),
        },
        { status: 429 }
      );
    }
    // 鍒涘缓鏀粯璁㈠崟鏁版嵁
    const order = {
      amount,
      currency,
      description: `${billingCycle === "monthly" ? "1 Month" : "1 Year"
        } Premium Membership (One-time Payment)`,
      userId: user.id,
      planType: "onetime",
      billingCycle,
      metadata: {
        userId: user.id,
        days, // 浼氬憳澶╂暟
        paymentType: "onetime",
        billingCycle,
      },
    };

    // 鏍规嵁鏀粯鏂瑰紡鍒涘缓鏀粯
    let result: CreatedPaymentResult | null = null;

    try {
      if (method === "stripe") {
        logInfo("Creating Stripe one-time payment", {
          operationId,
          userId: user.id,
          amount,
        });
        const stripeProvider = new StripeProvider(process.env);
        // Stripe 涓€娆℃€ф敮锟?浣跨敤 payment mode 鑰屼笉锟?subscription mode)
        result = await stripeProvider.createOnetimePayment(order);
      } else if (method === "alipay") {
        logInfo("Creating Alipay one-time payment", {
          operationId,
          userId: user.id,
          amount,
        });
        const alipayProvider = new AlipayProvider(process.env);
        result = await alipayProvider.createPayment(order);
      } else if (method === "wechat") {
        logInfo("Creating WeChat Native one-time payment", {
          operationId,
          userId: user.id,
          amount,
        });

        const outTradeNo = `WX${Date.now()}${Math.random()
          .toString(36)
          .substr(2, 9)
          .toUpperCase()}`;

        // 鍒濆鍖栧井淇℃敮浠樻彁渚涘晢
        const wechatProvider = new WechatProviderV3({
          appId: getWechatPayAppId(),
          mchId: getWechatPayMerchantId(),
          apiV3Key: getWechatPayApiV3Key(),
          privateKey: getWechatPayPrivateKey(),
          serialNo: getWechatPaySerialNo(),
          notifyUrl: `${getAppUrl()}/api/payment/webhook/wechat`,
        });

        // 鍒涘缓寰俊 NATIVE 鏀粯璁㈠崟
        const wechatResponse = await wechatProvider.createNativePayment({
          out_trade_no: outTradeNo,
          amount: Math.round(amount * 100), // 杞崲涓哄垎
          description: order.description,
        });

        result = {
          success: true,
          paymentId: outTradeNo,
          paymentUrl: wechatResponse.codeUrl,
          codeUrl: wechatResponse.codeUrl,
          transactionId: outTradeNo,
        };
      } else {
        return NextResponse.json(
          { success: false, error: `Unsupported payment method: ${method}` },
          { status: 400 }
        );
      }
    } catch (providerError) {
      logError("Payment provider error", providerError as Error, {
        operationId,
        userId: user.id,
        method,
      });
      return NextResponse.json(
        {
          success: false,
          error:
            providerError instanceof Error
              ? providerError.message
              : "Payment provider error",
        },
        { status: 500 }
      );
    }

    // 璁板綍鍒版暟鎹簱
    if (result && result.success && result.paymentId) {
      const normalizedFields = buildSubscriptionPaymentFields({
        planType: "onetime",
        billingCycle,
        days,
      });
      const nowIso = new Date().toISOString();

      try {
        await createPendingPaymentRecord({
          userId: user.id,
          amount,
          currency,
          paymentMethod: method,
          orderId: result.paymentId,
          transactionId: result.transactionId || result.paymentId,
          codeUrl: result.codeUrl,
          nowIso,
          paymentFields: {
            ...normalizedFields,
            metadata: {
              ...normalizedFields.metadata,
              paymentType: "onetime",
              source: "onetime-create-route",
            },
          },
          clientType: method === "wechat" ? "native" : undefined,
        });
      } catch (paymentRecordError) {
        logError(
          "Failed to persist one-time payment record",
          paymentRecordError instanceof Error
            ? paymentRecordError
            : new Error(String(paymentRecordError)),
          {
            operationId,
            userId: user.id,
            transactionId: result.paymentId,
            amount,
            currency,
            method,
          }
        );
        return NextResponse.json(
          {
            success: false,
            error: "PAYMENT_RECORD_PERSIST_FAILED",
            operationId,
          },
          { status: 500 }
        );
      }
    }

    if (!result) {
      return NextResponse.json(
        { success: false, error: "Payment creation failed" },
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;
    logInfo("One-time payment created successfully", {
      operationId,
      userId: user.id,
      method,
      amount,
      days,
      duration: `${duration}ms`,
    });

    return NextResponse.json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    logError("One-time payment creation error", error as Error, {
      operationId,
      duration: `${duration}ms`,
    });
    captureException(error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}




