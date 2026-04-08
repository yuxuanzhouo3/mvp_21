import { NextRequest, NextResponse } from "next/server";

import { AlipayProvider } from "@/lib/architecture-modules/layers/third-party/payment/providers/alipay-provider";
import { WebhookHandler } from "../../../../../lib/payment/webhook-handler";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};

    formData.forEach((value, key) => {
      params[key] = String(value);
    });

    const provider = new AlipayProvider(process.env);
    const isValidSignature = await provider.verifyCallback(params);

    if (!isValidSignature) {
      return new NextResponse("failure", { status: 401 });
    }

    const tradeStatus = params.trade_status;
    if (tradeStatus !== "TRADE_SUCCESS" && tradeStatus !== "TRADE_FINISHED") {
      return new NextResponse("success");
    }

    const webhookHandler = WebhookHandler.getInstance();
    const success = await webhookHandler.processWebhook(
      "alipay",
      tradeStatus,
      params,
    );

    return new NextResponse(success ? "success" : "failure");
  } catch (error) {
    console.error("Alipay webhook error:", error);
    return new NextResponse("failure");
  }
}
