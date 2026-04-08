import { NextRequest, NextResponse } from "next/server";

import { WechatProviderV3 } from "@/lib/architecture-modules/layers/third-party/payment/providers/wechat-provider-v3";
import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import {
  getAppUrl,
  getWechatPayApiV3Key,
  getWechatPayAppId,
} from "@/lib/config/runtime-env";
import { applySubscriptionPaymentSuccess } from "@/lib/payment/subscription-payment-sync";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("Wechatpay-Signature") || "";
    const timestamp = request.headers.get("Wechatpay-Timestamp") || "";
    const nonce = request.headers.get("Wechatpay-Nonce") || "";
    const body = await request.text();

    const provider = new WechatProviderV3({
      appId: getWechatPayAppId(),
      mchId: process.env.WECHAT_PAY_MCH_ID!,
      apiV3Key: getWechatPayApiV3Key(),
      privateKey: process.env.WECHAT_PAY_PRIVATE_KEY!,
      serialNo: process.env.WECHAT_PAY_SERIAL_NO!,
      notifyUrl: `${getAppUrl()}/api/payment/webhook/wechat`,
    });

    if (!provider.verifyWebhookSignature(body, signature, timestamp, nonce)) {
      return NextResponse.json(
        { code: "FAIL", message: "Invalid signature" },
        { status: 401 },
      );
    }

    const webhookData = JSON.parse(body);
    if (webhookData.event_type !== "TRANSACTION.SUCCESS") {
      return NextResponse.json({ code: "SUCCESS", message: "Ok" }, { status: 200 });
    }

    const paymentData = await provider.handleWebhookNotification(webhookData);
    if (paymentData.trade_state !== "SUCCESS") {
      return NextResponse.json({ code: "SUCCESS", message: "Ok" }, { status: 200 });
    }

    const webhookEventId = `wechat_${paymentData.transaction_id}`;
    const db = getDatabase();

    const existingEvent = await db
      .collection("webhook_events")
      .where({ id: webhookEventId })
      .limit(1)
      .get();

    if (existingEvent.data?.[0]?.processed) {
      return NextResponse.json({ code: "SUCCESS", message: "Ok" }, { status: 200 });
    }

    const paymentResult = await db
      .collection("payments")
      .where({ out_trade_no: paymentData.out_trade_no })
      .limit(1)
      .get();

    const paymentRecord = paymentResult.data?.[0];
    if (!paymentRecord?.user_id) {
      return NextResponse.json(
        { code: "FAIL", message: "Payment record not found" },
        { status: 400 },
      );
    }

    if (!existingEvent.data?.length) {
      await db.collection("webhook_events").add({
        id: webhookEventId,
        provider: "wechat",
        event_type: "TRANSACTION.SUCCESS",
        event_data: paymentData,
        processed: false,
        created_at: new Date().toISOString(),
      });
    }

    await applySubscriptionPaymentSuccess({
      payment: paymentRecord,
      finalTransactionId: paymentData.transaction_id || paymentData.out_trade_no,
      providerReference: paymentData.out_trade_no,
      amount: paymentData.amount?.total ? paymentData.amount.total / 100 : paymentRecord.amount,
      currency: paymentRecord.currency || "CNY",
      paymentMethod: "wechat",
    });

    await db.collection("webhook_events").where({ id: webhookEventId }).update({
      processed: true,
      processed_at: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        code: "SUCCESS",
        message: "Ok",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("WeChat webhook processing error:", error);
    return NextResponse.json(
      {
        code: "FAIL",
        message: "Internal server error",
      },
      { status: 500 },
    );
  }
}
