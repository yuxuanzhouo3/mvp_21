import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { WechatProviderV3 } from "@/lib/architecture-modules/layers/third-party/payment/providers/wechat-provider-v3";
import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import {
  getAppUrl,
  getWechatPayApiV3Key,
  getWechatPayAppId,
} from "@/lib/config/runtime-env";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";
import {
  applySubscriptionPaymentSuccess,
  applySubscriptionPaymentTerminalStatus,
} from "@/lib/payment/subscription-payment-sync";

const querySchema = z.object({
  paymentId: z.string().min(1, "paymentId is required"),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const paymentId = searchParams.get("paymentId");

    const validationResult = querySchema.safeParse({ paymentId });
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid input",
          details: validationResult.error.errors,
        },
        { status: 400 },
      );
    }

    let paymentRecord: any = null;

    if (isChinaRegion()) {
      const db = getDatabase();
      const result = await db
        .collection("payments")
        .where({
          $or: [
            { out_trade_no: paymentId },
            { _id: paymentId },
            { transaction_id: paymentId },
            { order_id: paymentId },
          ],
        })
        .limit(1)
        .get();

      paymentRecord = result.data?.[0] || null;
    } else {
      const { data, error } = await supabaseAdmin
        .from("payments")
        .select("*")
        .or(
          `out_trade_no.eq.${paymentId},transaction_id.eq.${paymentId},order_id.eq.${paymentId},id.eq.${paymentId}`,
        )
        .limit(1);

      if (error) {
        throw error;
      }

      paymentRecord = data?.[0] || null;
    }

    if (!paymentRecord) {
      return NextResponse.json(
        {
          success: false,
          error: "Payment record not found",
          status: "unknown",
        },
        { status: 404 },
      );
    }

    let finalStatus = paymentRecord.status || "pending";

    if (paymentRecord.payment_method === "wechat") {
      const wechatProvider = new WechatProviderV3({
        appId: getWechatPayAppId(),
        mchId: process.env.WECHAT_PAY_MCH_ID!,
        apiV3Key: getWechatPayApiV3Key(),
        privateKey: process.env.WECHAT_PAY_PRIVATE_KEY!,
        serialNo: process.env.WECHAT_PAY_SERIAL_NO!,
        notifyUrl: `${getAppUrl()}/api/payment/webhook/wechat`,
      });

      const outTradeNo =
        paymentRecord.out_trade_no ||
        paymentRecord.transaction_id ||
        paymentRecord.order_id ||
        paymentId!;

      try {
        const wechatStatus = await wechatProvider.queryOrderByOutTradeNo(outTradeNo);
        finalStatus = mapTradeStateToPaymentStatus(wechatStatus.tradeState);

        if (finalStatus === "completed" && paymentRecord.status !== "completed") {
          await applySubscriptionPaymentSuccess({
            payment: paymentRecord,
            finalTransactionId: wechatStatus.transactionId || outTradeNo,
            providerReference: outTradeNo,
            amount: wechatStatus.amount ? wechatStatus.amount / 100 : paymentRecord.amount,
            currency: paymentRecord.currency || "CNY",
            paymentMethod: "wechat",
          });
          paymentRecord.status = "completed";
        } else if (finalStatus === "refunded" && paymentRecord.status !== "refunded") {
          await applySubscriptionPaymentTerminalStatus({
            payment: paymentRecord,
            paymentStatus: "refunded",
            finalTransactionId: wechatStatus.transactionId || outTradeNo,
            subscriptionStatus: "cancelled",
          });
          paymentRecord.status = "refunded";
        } else if (
          finalStatus === "failed" &&
          paymentRecord.status !== "failed" &&
          paymentRecord.status !== "completed"
        ) {
          await applySubscriptionPaymentTerminalStatus({
            payment: paymentRecord,
            paymentStatus: "failed",
            finalTransactionId: wechatStatus.transactionId || outTradeNo,
          });
          paymentRecord.status = "failed";
        }
      } catch (error) {
        console.error("Error querying WeChat status:", error);
        finalStatus = paymentRecord.status || "pending";
      }
    }

    return NextResponse.json(
      {
        success: true,
        paymentId,
        status: finalStatus,
        amount: paymentRecord.amount,
        currency: paymentRecord.currency,
        method: paymentRecord.payment_method || "",
        createdAt: paymentRecord.created_at || paymentRecord.createdAt,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Payment status query error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
        status: "unknown",
      },
      { status: 500 },
    );
  }
}

function mapTradeStateToPaymentStatus(tradeState: string): string {
  const stateMap: Record<string, string> = {
    SUCCESS: "completed",
    NOTPAY: "pending",
    CLOSED: "failed",
    REFUND: "refunded",
    REVOKED: "failed",
    USERPAYING: "pending",
    PAYERROR: "failed",
  };

  return stateMap[tradeState] || "unknown";
}
