import { NextRequest, NextResponse } from "next/server";

import { PayPalProvider } from "@/lib/architecture-modules/layers/third-party/payment/providers/paypal-provider";
import { isChinaRegion } from "@/lib/config/region";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";
import {
  applySubscriptionPaymentSuccess,
  applySubscriptionPaymentTerminalStatus,
} from "@/lib/payment/subscription-payment-sync";
import { webhookRateLimit } from "@/lib/security/rate-limit";
import { logError } from "@/lib/utils/logger";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return new Promise<NextResponse>((resolve) => {
    const mockRes = {
      status: (code: number) => ({
        json: (data: unknown) => resolve(NextResponse.json(data, { status: code })),
      }),
      setHeader: () => {},
      getHeader: () => undefined,
    };

    webhookRateLimit(request as any, mockRes as any, async () => {
      resolve(await handlePayPalWebhook(request));
    });
  });
}

async function handlePayPalWebhook(request: NextRequest) {
  const operationId = `paypal_webhook_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 11)}`;

  try {
    if (isChinaRegion()) {
      return NextResponse.json({ received: true });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const transmissionId = request.headers.get("paypal-transmission-id");
    const transmissionSig = request.headers.get("paypal-transmission-sig");
    const transmissionTime = request.headers.get("paypal-transmission-time");
    const certUrl = request.headers.get("paypal-cert-url");
    const authAlgo = request.headers.get("paypal-auth-algo") || undefined;

    if (!transmissionId || !transmissionSig || !transmissionTime || !certUrl) {
      return NextResponse.json(
        { error: "Missing required PayPal webhook headers" },
        { status: 400 },
      );
    }

    const provider = new PayPalProvider(process.env);
    const verified = await provider.verifyWebhookSignature({
      body,
      transmissionId,
      transmissionSig,
      transmissionTime,
      certUrl,
      authAlgo,
    });

    if (!verified) {
      return NextResponse.json({ error: "Invalid PayPal signature" }, { status: 401 });
    }

    const eventId = String(body.id || transmissionId);
    const eventType = String(body.event_type || "");

    const existing = await supabaseAdmin
      .from("webhook_events")
      .select("id")
      .eq("id", eventId)
      .maybeSingle();

    if (existing.data?.id) {
      return NextResponse.json({ received: true, deduplicated: true });
    }

    await supabaseAdmin.from("webhook_events").insert({
      id: eventId,
      provider: "paypal",
      event_type: eventType || "unknown",
      event_data: body,
      processed: false,
      created_at: new Date().toISOString(),
    });

    const resource = (body.resource || {}) as Record<string, any>;
    const orderId =
      String(resource.supplementary_data?.related_ids?.order_id || resource.id || "");
    const captureId = String(resource.id || orderId);

    if (!orderId) {
      await supabaseAdmin
        .from("webhook_events")
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq("id", eventId);
      return NextResponse.json({ received: true });
    }

    const paymentLookup = await supabaseAdmin
      .from("payments")
      .select("*")
      .or(`transaction_id.eq.${orderId},order_id.eq.${orderId},out_trade_no.eq.${orderId}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const payment = paymentLookup.data;
    if (payment) {
      if (eventType === "PAYMENT.CAPTURE.COMPLETED" || eventType === "CHECKOUT.ORDER.COMPLETED") {
        await applySubscriptionPaymentSuccess({
          payment,
          finalTransactionId: captureId,
          providerReference: orderId,
          amount: Number.parseFloat(String(resource.amount?.value || payment.amount || 0)),
          currency: String(resource.amount?.currency_code || payment.currency || "USD").toUpperCase(),
          paymentMethod: "paypal",
        });
      } else if (
        eventType === "PAYMENT.CAPTURE.DENIED" ||
        eventType === "PAYMENT.CAPTURE.REFUNDED" ||
        eventType === "PAYMENT.CAPTURE.REVERSED"
      ) {
        await applySubscriptionPaymentTerminalStatus({
          payment,
          paymentStatus:
            eventType === "PAYMENT.CAPTURE.REFUNDED" ? "refunded" : "failed",
          finalTransactionId: captureId,
          subscriptionStatus:
            eventType === "PAYMENT.CAPTURE.REFUNDED" ? "cancelled" : undefined,
        });
      }
    }

    await supabaseAdmin
      .from("webhook_events")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("id", eventId);

    return NextResponse.json({ received: true });
  } catch (error) {
    logError(
      "paypal_webhook_error",
      error instanceof Error ? error : new Error(String(error)),
      {
        operationId,
        error: error instanceof Error ? error.message : String(error),
      },
    );

    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
