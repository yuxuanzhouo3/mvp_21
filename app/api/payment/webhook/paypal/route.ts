// app/api/payment/webhook/paypal/route.ts - PayPal webhook处理
import { NextRequest, NextResponse } from "next/server";
import { WebhookHandler } from "../../../../../lib/payment/webhook-handler";
import { getPayPalMode } from "@/lib/config/runtime-env";

// PayPal Webhook 必须在 Node.js Runtime 下运行
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  console.log("🌐🌐🌐 [PAYPAL WEBHOOK /api/payment/webhook/paypal] STARTED - Entry point");

  try {
    const body = await request.text();
    console.log("🌐🌐🌐 [PAYPAL WEBHOOK] Body received, length:", body.length);

    // 修复：使用正确的PayPal头名称
    const signature = request.headers.get("paypal-transmission-sig"); // 注意：不是 signature
    const certUrl = request.headers.get("paypal-cert-url");
    const transmissionId = request.headers.get("paypal-transmission-id");
    const timestamp = request.headers.get("paypal-transmission-time");
    const authAlgo = request.headers.get("paypal-auth-algo");

    // 记录所有PayPal相关头用于调试
    console.log("🔍 PayPal webhook headers received:", {
      signature: signature ? signature.substring(0, 20) + "..." : "MISSING",
      certUrl: certUrl ? certUrl.substring(0, 50) + "..." : "MISSING",
      transmissionId,
      timestamp,
      authAlgo,
      allPayPalHeaders: Object.fromEntries(
        Array.from(request.headers.entries()).filter(([key]) =>
          key.toLowerCase().includes("paypal")
        )
      ),
    });

    // 验证PayPal webhook签名
    const skipSignatureVerification =
      process.env.PAYPAL_SKIP_SIGNATURE_VERIFICATION === "true";
    const isValidSignature = skipSignatureVerification
      ? true
      : await verifyPayPalSignature({
          body,
          signature,
          certUrl,
          transmissionId,
          timestamp,
          authAlgo,
        });

    if (!isValidSignature) {
      console.error("❌ PayPal webhook signature verification failed:", {
        skipSignatureVerification,
        hasSignature: !!signature,
        hasCertUrl: !!certUrl,
        hasTransmissionId: !!transmissionId,
        hasTimestamp: !!timestamp,
        hasAuthAlgo: !!authAlgo,
        webhookId: process.env.PAYPAL_WEBHOOK_ID,
        environment: getPayPalMode(),
        webhookUrl: `${
          process.env.APP_URL || "https://mvp-24-main.vercel.app"
        }/api/payment/webhook/paypal`,
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 解析webhook数据
    const webhookData = JSON.parse(body);
    const eventType = webhookData.event_type;

    console.log("Received PayPal webhook:", {
      eventType,
      transmissionId,
      resourceId: webhookData.resource?.id,
    });

    // 🔧 PayPal去重：使用 transmissionId 作为唯一标识，防止重复处理
    // PayPal 可能会重复发送相同的事件，transmissionId 是唯一的
    if (transmissionId) {
      webhookData._paypal_transmission_id = transmissionId;
      console.log("✅ Added PayPal transmissionId for deduplication:", {
        transmissionId,
      });
    }

    // 处理webhook事件
    const webhookHandler = WebhookHandler.getInstance();
    const success = await webhookHandler.processWebhook(
      "paypal",
      eventType,
      webhookData
    );

    if (success) {
      return NextResponse.json({ status: "success" });
    } else {
      console.error("Failed to process PayPal webhook");
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  } catch (error) {
    console.error("PayPal webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * 验证PayPal webhook签名
 */
async function verifyPayPalSignature(args: {
  body: string;
  signature: string | null;
  certUrl: string | null;
  transmissionId: string | null;
  timestamp: string | null;
  authAlgo: string | null;
}): Promise<boolean> {
  const { body, signature, certUrl, transmissionId, timestamp, authAlgo } =
    args;
  try {
    // 在开发环境下可选择跳过（如需端到端联调，可设置 PAYPAL_VERIFY_WEBHOOK=false）
    if (
      process.env.NODE_ENV === "development" &&
      process.env.PAYPAL_VERIFY_WEBHOOK !== "true"
    ) {
      return true;
    }

    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    if (!clientId || !clientSecret || !webhookId) {
      console.error("Missing PayPal credentials or webhook id");
      return false;
    }

    if (!signature || !certUrl || !transmissionId || !timestamp || !authAlgo) {
      console.error("❌ Missing PayPal signature headers:", {
        hasSignature: !!signature,
        hasCertUrl: !!certUrl,
        hasTransmissionId: !!transmissionId,
        hasTimestamp: !!timestamp,
        hasAuthAlgo: !!authAlgo,
        signature: signature?.substring(0, 50) + "...",
        certUrl: certUrl?.substring(0, 50) + "...",
        transmissionId,
        timestamp,
        authAlgo,
      });
      return false;
    }

    const baseUrl =
      process.env.PAYPAL_API_BASE ||
      (getPayPalMode() === "sandbox"
        ? "https://api-m.sandbox.paypal.com"
        : "https://api-m.paypal.com");

    // 1) 获取访问令牌
    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenRes.ok) {
      console.error(
        "Failed to obtain PayPal access token",
        await tokenRes.text()
      );
      return false;
    }
    const { access_token } = (await tokenRes.json()) as {
      access_token: string;
    };

    // 2) 调用验证接口
    const verifyRes = await fetch(
      `${baseUrl}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transmission_id: transmissionId,
          transmission_time: timestamp,
          cert_url: certUrl,
          auth_algo: authAlgo,
          transmission_sig: signature,
          webhook_id: webhookId,
          webhook_event: JSON.parse(body),
        }),
      }
    );

    if (!verifyRes.ok) {
      console.error("PayPal verify webhook API error", await verifyRes.text());
      return false;
    }

    const verifyData = (await verifyRes.json()) as {
      verification_status?: string;
    };
    const ok = verifyData.verification_status === "SUCCESS";
    if (!ok) {
      console.error("❌ PayPal webhook verification failed:", {
        verificationStatus: verifyData.verification_status,
        fullResponse: verifyData,
        webhookId: process.env.PAYPAL_WEBHOOK_ID,
        environment: getPayPalMode(),
        baseUrl,
        transmissionId,
        webhookEvent: JSON.parse(body),
      });
    } else {
      console.log("✅ PayPal webhook signature verified successfully");
    }
    return ok;
  } catch (error) {
    console.error("PayPal signature verification error:", error);
    return false;
  }
}
