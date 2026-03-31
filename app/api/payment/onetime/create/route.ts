// app/api/payment/onetime/create/route.ts - 一次性支付创建API
import { NextRequest, NextResponse } from "next/server";
import { PayPalProvider } from "@/lib/architecture-modules/layers/third-party/payment/providers/paypal-provider";
import { StripeProvider } from "@/lib/architecture-modules/layers/third-party/payment/providers/stripe-provider";
import { AlipayProvider } from "@/lib/architecture-modules/layers/third-party/payment/providers/alipay-provider";
import { WechatProviderV3 } from "@/lib/architecture-modules/layers/third-party/payment/providers/wechat-provider-v3";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";
import { requireAuth, createAuthErrorResponse } from "@/lib/auth/auth";
import { getDatabase } from "@/lib/auth/auth-utils";
import { isChinaRegion } from "@/lib/config/region";
import { paymentRateLimit } from "@/lib/security/rate-limit";
import { captureException } from "@/lib/integrations/sentry";
import { logInfo, logError, logWarn } from "@/lib/utils/logger";
import {
  getPricingByMethod,
  getDaysByBillingCycle,
} from "@/lib/payment/payment-config";
import type { PaymentMethod, BillingCycle } from "@/lib/payment/payment-config";

type CreatedPaymentResult = {
  success: boolean;
  paymentId?: string;
  paymentUrl?: string;
  codeUrl?: string;
  transactionId?: string;
  error?: string;
};

export async function POST(request: NextRequest) {
  // 应用速率限制
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
    // 验证用户认证
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

    // 验证必需参数
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

    // 验证 billingCycle
    if (!["monthly", "yearly"].includes(billingCycle)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid billing cycle. Must be 'monthly' or 'yearly'",
        },
        { status: 400 }
      );
    }

    // 使用统一的支付配置获取货币和金额
    const pricing = getPricingByMethod(method);
    const currency = pricing.currency;
    const amount = pricing[billingCycle];
    const days = getDaysByBillingCycle(billingCycle);

    // 检查最近1分钟内是否有相同的pending或completed支付(防止重复点击)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    let recentPayments: any[] = [];
    let checkError: any = null;

    if (isChinaRegion()) {
      // CloudBase 查询
      try {
        const db = getDatabase();
        const _ = db.command;
        const result = await db
          .collection("payments")
          .where({
            user_id: user.id,
            amount: amount,
            currency: currency,
            payment_method: method,
            created_at: _.gte(oneMinuteAgo),
            status: _.in(["pending", "completed"]),
          })
          .orderBy("created_at", "desc")
          .limit(1)
          .get();

        recentPayments = result.data || [];
      } catch (error) {
        checkError = error;
      }
    } else {
      // Supabase 查询
      const result = await supabaseAdmin
        .from("payments")
        .select("id, status, created_at")
        .eq("user_id", user.id)
        .eq("amount", amount)
        .eq("currency", currency)
        .eq("payment_method", method)
        .gte("created_at", oneMinuteAgo)
        .in("status", ["pending", "completed"])
        .order("created_at", { ascending: false })
        .limit(1);

      recentPayments = result.data || [];
      checkError = result.error;
    }

    if (checkError && (!isChinaRegion() || checkError.code !== "PGRST116")) {
      logError("Error checking existing payment", checkError, {
        operationId,
        userId: user.id,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Unable to verify payment uniqueness, please try again",
        },
        { status: 500 }
      );
    }

    // 如果存在最近的支付,拒绝创建新订单
    if (recentPayments && recentPayments.length > 0) {
      const latestPayment = recentPayments[0];
      const paymentAge =
        Date.now() - new Date(latestPayment.created_at).getTime();

      logWarn("Duplicate payment request blocked", {
        operationId,
        userId: user.id,
        existingPaymentId: latestPayment.id,
        paymentAge: `${Math.floor(paymentAge / 1000)}s`,
      });

      return NextResponse.json(
        {
          success: false,
          error:
            "You have a recent payment request. Please wait a moment before trying again.",
          code: "DUPLICATE_PAYMENT_REQUEST",
          existingPaymentId: latestPayment.id,
          waitTime: Math.ceil((60000 - paymentAge) / 1000),
        },
        { status: 429 }
      );
    }

    // 创建支付订单数据
    const order = {
      amount,
      currency,
      description: `${billingCycle === "monthly" ? "1 Month" : "1 Year"
        } Premium Membership (One-time Payment)`,
      userId: user.id,
      planType: "onetime", // 标记为一次性支付
      billingCycle,
      metadata: {
        userId: user.id,
        days, // 会员天数
        paymentType: "onetime",
        billingCycle,
      },
    };

    // 根据支付方式创建支付
    let result: CreatedPaymentResult | null = null;

    try {
      if (method === "stripe") {
        logInfo("Creating Stripe one-time payment", {
          operationId,
          userId: user.id,
          amount,
        });
        const stripeProvider = new StripeProvider(process.env);
        // Stripe 一次性支付(使用 payment mode 而不是 subscription mode)
        result = await stripeProvider.createOnetimePayment(order);
      } else if (method === "paypal") {
        logInfo("Creating PayPal one-time payment", {
          operationId,
          userId: user.id,
          amount,
        });
        const paypalProvider = new PayPalProvider(process.env);
        // PayPal 一次性支付(使用 order 而不是 subscription)
        result = await paypalProvider.createOnetimePayment(order);
      } else if (method === "alipay") {
        logInfo("Creating Alipay one-time payment", {
          operationId,
          userId: user.id,
          amount,
        });
        const alipayProvider = new AlipayProvider(process.env);
        // 支付宝一次性支付
        result = await alipayProvider.createPayment(order);
      } else if (method === "wechat") {
        logInfo("Creating WeChat Native one-time payment", {
          operationId,
          userId: user.id,
          amount,
        });

        // 微信支付仅支持中国区域
        if (!isChinaRegion()) {
          return NextResponse.json(
            {
              success: false,
              error: "WeChat payment is only available in China region",
            },
            { status: 400 }
          );
        }

        // 生成商户订单号
        const out_trade_no = `WX${Date.now()}${Math.random()
          .toString(36)
          .substr(2, 9)
          .toUpperCase()}`;

        // 初始化微信支付提供商
        const wechatProvider = new WechatProviderV3({
          appId: process.env.WECHAT_APP_ID!,
          mchId: process.env.WECHAT_PAY_MCH_ID!,
          apiV3Key: process.env.WECHAT_PAY_API_V3_KEY!,
          privateKey: process.env.WECHAT_PAY_PRIVATE_KEY!,
          serialNo: process.env.WECHAT_PAY_SERIAL_NO!,
          notifyUrl: `${process.env.APP_URL}/api/payment/webhook/wechat`,
        });

        // 创建微信 NATIVE 支付订单
        const wechatResponse = await wechatProvider.createNativePayment({
          out_trade_no,
          amount: Math.round(amount * 100), // 转换为分
          description: order.description,
        });

        result = {
          success: true,
          paymentId: out_trade_no,
          paymentUrl: wechatResponse.codeUrl,
          codeUrl: wechatResponse.codeUrl, // 兼容旧的字段名
          transactionId: out_trade_no,
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

    // 记录到数据库
    if (result && result.success && result.paymentId) {
      const paymentData: any = {
        user_id: user.id,
        amount,
        currency,
        status: "pending",
        payment_method: method,
        transaction_id: result.paymentId,
        metadata: {
          days,
          paymentType: "onetime",
          billingCycle,
        },
      };

      // 微信支付额外字段
      if (method === "wechat") {
        paymentData.out_trade_no = result.paymentId;
        paymentData.code_url = result.codeUrl;
        paymentData.client_type = "native";
      }

      try {
        if (isChinaRegion()) {
          // CloudBase 插入
          const db = getDatabase();
          await db.collection("payments").add(paymentData);
        } else {
          // Supabase 插入
          console.log("💾 Inserting payment data to Supabase:", {
            transactionId: result.paymentId,
            metadata: paymentData.metadata,
          });

          const { data: insertedPayment, error: paymentRecordError } =
            await supabaseAdmin
              .from("payments")
              .insert([paymentData])
              .select("id, metadata");

          if (paymentRecordError) {
            console.error("❌ Supabase insert error:", paymentRecordError);
            throw paymentRecordError;
          }

          if (insertedPayment && insertedPayment.length > 0) {
            const payment = insertedPayment[0];
            console.log("✅ Payment record created with metadata:", {
              paymentId: payment.id,
              metadata: payment.metadata,
            });
            logInfo("Payment record created", {
              operationId,
              userId: user.id,
              paymentId: payment.id,
              transactionId: result.paymentId,
              amount,
              days,
              metadataSaved: payment.metadata,
            });
          }
        }
      } catch (paymentRecordError) {
        console.error("❌ Error recording payment:", paymentRecordError);
        logError(
          "Error recording payment",
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
        // 继续执行,不阻断支付流程
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
