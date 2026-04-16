// app/api/payment/onetime/webhook/route.ts - 一次性支付 Webhook 处理
import { NextRequest, NextResponse } from "next/server";

import { isChinaRegion } from "@/lib/config/region";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";
import { ensureOnetimeMembershipApplied } from "@/lib/payment/onetime-membership-sync";
import { webhookRateLimit } from "@/lib/security/rate-limit";
import { logBusinessEvent, logError, logInfo, logWarn } from "@/lib/utils/logger";

export const runtime = "nodejs";

type StripeWebhookEvent = {
  id?: string;
  type?: string;
  data?: {
    object?: any;
  };
};

async function extendMembership(
  userId: string,
  days: number,
  transactionId: string,
): Promise<boolean> {
  const result = await ensureOnetimeMembershipApplied({
    userId,
    days,
    transactionId,
    source: "onetime-webhook",
  });

  if (!result.success) {
    logWarn("Unified onetime membership sync failed in webhook", {
      userId,
      days,
      transactionId,
      reason: result.reason,
    });
  }

  return result.success;
}

function constructStripeEvent(
  payload: string,
  signature: string | null,
  secret: string | undefined,
): StripeWebhookEvent | null {
  if (!signature || !secret) {
    return null;
  }

  try {
    const stripe = require("stripe");
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    logWarn("Invalid Stripe webhook signature", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function handleStripeWebhook(event: StripeWebhookEvent): Promise<NextResponse> {
  const operationId = `stripe_onetime_webhook_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 11)}`;

  try {
    if (!event.id || !event.type) {
      logWarn("Stripe webhook payload missing required fields", {
        operationId,
        hasId: !!event.id,
        hasType: !!event.type,
      });
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
    }

    logInfo("Stripe onetime webhook received", {
      operationId,
      eventType: event.type,
      eventId: event.id,
    });

    const eventRecordId = `stripe_${event.id}`;

    const { data: existingEvent } = await supabaseAdmin
      .from("webhook_events")
      .select("id")
      .eq("id", eventRecordId)
      .eq("processed", true)
      .maybeSingle();

    if (existingEvent) {
      logInfo("Stripe onetime webhook already processed", {
        operationId,
        eventRecordId,
      });
      return NextResponse.json({ received: true });
    }

    await supabaseAdmin.from("webhook_events").upsert({
      id: eventRecordId,
      provider: "stripe",
      event_type: event.type,
      event_data: event,
      processed: false,
      created_at: new Date().toISOString(),
    });

    if (event.type === "checkout.session.completed") {
      const session = event.data?.object;

      if (session?.payment_status === "paid" && session?.mode === "payment") {
        const userId = session.metadata?.userId;
        const days = Number.parseInt(session.metadata?.days || "30", 10);
        const transactionId = session.id;

        if (!userId) {
          logError("Missing userId in Stripe onetime webhook metadata", undefined, {
            operationId,
            sessionId: session?.id,
          });
          return NextResponse.json({ received: true });
        }

        const amount = session.amount_total ? session.amount_total / 100 : 0;
        const currency = session.currency?.toUpperCase() || "USD";

        logInfo("Processing Stripe onetime webhook payment", {
          operationId,
          userId,
          transactionId,
          amount,
          currency,
          days,
        });

        const { data: existingPayment } = await supabaseAdmin
          .from("payments")
          .select("id, status, subscription_id")
          .eq("transaction_id", transactionId)
          .maybeSingle();

        let paymentId = existingPayment?.id;
        let subscriptionId = existingPayment?.subscription_id;

        if (existingPayment && existingPayment.status !== "completed") {
          const { error: updateError } = await supabaseAdmin
            .from("payments")
            .update({
              status: "completed",
              amount,
              currency,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingPayment.id);

          if (updateError) {
            logError("Failed to update onetime payment status from webhook", updateError, {
              operationId,
              paymentId: existingPayment.id,
            });
          }
        } else if (!existingPayment) {
          const { data: newPayment, error: insertError } = await supabaseAdmin
            .from("payments")
            .insert({
              user_id: userId,
              amount,
              currency,
              status: "completed",
              payment_method: "stripe",
              transaction_id: transactionId,
            })
            .select("id, subscription_id")
            .single();

          if (insertError) {
            logError("Failed to create onetime payment record from webhook", insertError, {
              operationId,
              userId,
              transactionId,
            });
          } else if (newPayment) {
            paymentId = newPayment.id;
            subscriptionId = newPayment.subscription_id;
          }
        }

        if (!subscriptionId) {
          const currentDate = new Date();
          const expiresDate = new Date();
          expiresDate.setDate(expiresDate.getDate() + days);

          const { data: newSubscription, error: subInsertError } = await supabaseAdmin
            .from("subscriptions")
            .insert({
              user_id: userId,
              plan_id: "pro",
              status: "active",
              current_period_start: currentDate.toISOString(),
              current_period_end: expiresDate.toISOString(),
              cancel_at_period_end: false,
              provider_subscription_id: transactionId,
              transaction_id: transactionId,
            })
            .select("id")
            .single();

          if (subInsertError) {
            logError("Failed to create subscription from onetime webhook", subInsertError, {
              operationId,
              userId,
              transactionId,
            });
          } else if (newSubscription && paymentId) {
            subscriptionId = newSubscription.id;
            const { error: linkError } = await supabaseAdmin
              .from("payments")
              .update({ subscription_id: newSubscription.id })
              .eq("id", paymentId);

            if (linkError) {
              logError("Failed to link payment and subscription in onetime webhook", linkError, {
                operationId,
                paymentId,
                subscriptionId: newSubscription.id,
              });
            }
          }
        }

        let success = false;
        if (!isChinaRegion()) {
          try {
            const { data: existingSub } = await supabaseAdmin
              .from("subscriptions")
              .select("id")
              .or(
                `transaction_id.eq.${transactionId},provider_subscription_id.eq.${transactionId}`,
              )
              .maybeSingle();

            if (existingSub?.id) {
              success = true;
            } else {
              success = await extendMembership(userId, days, transactionId);
            }
          } catch (err) {
            logWarn("Supabase idempotency check failed in onetime webhook", {
              operationId,
              userId,
              transactionId,
              err: err instanceof Error ? err.message : String(err),
            });
            success = await extendMembership(userId, days, transactionId);
          }
        } else {
          success = await extendMembership(userId, days, transactionId);
        }

        if (success) {
          await supabaseAdmin
            .from("webhook_events")
            .update({
              processed: true,
              processed_at: new Date().toISOString(),
            })
            .eq("id", eventRecordId);

          logBusinessEvent("stripe_onetime_payment_processed", userId, {
            operationId,
            transactionId,
            paymentId,
            subscriptionId,
            amount,
            currency,
            days,
          });
        } else {
          logError("Failed to apply membership sync in onetime webhook", undefined, {
            operationId,
            userId,
            transactionId,
          });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logError("Stripe onetime webhook processing failed", error as Error, {
      operationId,
    });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

async function handleOnetimeWebhook(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();
  const stripeSignature = request.headers.get("stripe-signature");

  if (!stripeSignature) {
    return NextResponse.json(
      {
        error: "Missing Stripe webhook signature.",
        code: "MISSING_STRIPE_SIGNATURE",
      },
      { status: 400 },
    );
  }

  const event = constructStripeEvent(
    rawBody,
    stripeSignature,
    process.env.STRIPE_WEBHOOK_SECRET,
  );

  if (!event) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  return handleStripeWebhook(event);
}

export async function POST(request: NextRequest) {
  return new Promise<NextResponse>((resolve) => {
    const mockRes = {
      status: (code: number) => ({
        json: (data: any) => resolve(NextResponse.json(data, { status: code })),
      }),
      setHeader: () => {},
      getHeader: () => undefined,
    };

    webhookRateLimit(request as any, mockRes as any, async () => {
      resolve(await handleOnetimeWebhook(request));
    });
  });
}
