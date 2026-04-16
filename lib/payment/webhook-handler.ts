import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";
import { applySubscriptionPaymentSuccess } from "@/lib/payment/subscription-payment-sync";
import { logError, logInfo, logWarn } from "@/lib/utils/logger";

type SupportedWebhookProvider = "stripe" | "alipay";

type PaymentResolution = {
  transactionId: string;
  providerReference: string;
  amount: number;
  currency: string;
};

function asNonEmptyString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asPositiveNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export class WebhookHandler {
  private static instance: WebhookHandler;

  private static readonly STRIPE_SUCCESS_EVENTS = new Set([
    "checkout.session.completed",
    "invoice.payment_succeeded",
    "payment_intent.succeeded",
  ]);

  private static readonly ALIPAY_SUCCESS_EVENTS = new Set([
    "TRADE_SUCCESS",
    "TRADE_FINISHED",
  ]);

  static getInstance(): WebhookHandler {
    if (!WebhookHandler.instance) {
      WebhookHandler.instance = new WebhookHandler();
    }

    return WebhookHandler.instance;
  }

  async processWebhook(
    provider: string,
    eventType: string,
    eventData: any,
  ): Promise<boolean> {
    if (provider !== "stripe" && provider !== "alipay") {
      logWarn("Unsupported payment webhook provider", {
        provider,
        eventType,
      });
      return false;
    }

    if (provider === "stripe") {
      if (!WebhookHandler.STRIPE_SUCCESS_EVENTS.has(eventType)) {
        return true;
      }

      const payload = eventData?.data?.object ?? eventData;
      return this.handleSuccessfulPayment("stripe", payload);
    }

    if (!WebhookHandler.ALIPAY_SUCCESS_EVENTS.has(eventType)) {
      return true;
    }

    return this.handleSuccessfulPayment("alipay", eventData);
  }

  private resolveStripePayment(payload: any): PaymentResolution {
    const sessionId = asNonEmptyString(payload?.id);
    const paymentIntentId = asNonEmptyString(payload?.payment_intent);
    const orderId = asNonEmptyString(payload?.metadata?.orderId);

    const amountCents = asPositiveNumber(payload?.amount_total ?? payload?.amount);
    const amount = amountCents > 0 ? amountCents / 100 : 0;

    return {
      transactionId: paymentIntentId || sessionId || orderId,
      providerReference: sessionId || paymentIntentId || orderId,
      amount,
      currency: asNonEmptyString(payload?.currency).toUpperCase() || "USD",
    };
  }

  private resolveAlipayPayment(payload: any): PaymentResolution {
    const outTradeNo = asNonEmptyString(payload?.out_trade_no);
    const tradeNo = asNonEmptyString(payload?.trade_no);

    const amount =
      asPositiveNumber(payload?.total_amount) ||
      asPositiveNumber(payload?.receipt_amount) ||
      asPositiveNumber(payload?.buyer_pay_amount);

    return {
      transactionId: outTradeNo || tradeNo,
      providerReference: tradeNo || outTradeNo,
      amount,
      currency: "CNY",
    };
  }

  private async findPaymentByReference(candidates: string[]): Promise<any | null> {
    const references = Array.from(
      new Set(candidates.map((item) => asNonEmptyString(item)).filter(Boolean)),
    );

    if (!references.length) {
      return null;
    }

    if (isChinaRegion()) {
      const db = getDatabase();

      for (const reference of references) {
        try {
          const result = await db
            .collection("payments")
            .where({
              $or: [
                { transaction_id: reference },
                { out_trade_no: reference },
                { order_id: reference },
              ],
            })
            .orderBy("created_at", "desc")
            .limit(1)
            .get();

          const payment = result.data?.[0] || null;
          if (payment) {
            return payment;
          }
        } catch (error) {
          logError("cloudbase_webhook_payment_lookup_failed", error as Error, {
            reference,
          });
        }
      }

      return null;
    }

    for (const reference of references) {
      const { data, error } = await supabaseAdmin
        .from("payments")
        .select("*")
        .or(`transaction_id.eq.${reference},out_trade_no.eq.${reference},order_id.eq.${reference}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        logError("supabase_webhook_payment_lookup_failed", error, {
          reference,
        });
      }

      if (data) {
        return data;
      }
    }

    return null;
  }

  private async handleSuccessfulPayment(
    provider: SupportedWebhookProvider,
    payload: any,
  ): Promise<boolean> {
    try {
      const resolution =
        provider === "stripe"
          ? this.resolveStripePayment(payload)
          : this.resolveAlipayPayment(payload);

      const payment = await this.findPaymentByReference([
        resolution.transactionId,
        resolution.providerReference,
        asNonEmptyString(payload?.metadata?.paymentId),
      ]);

      if (!payment) {
        logWarn("Payment record not found for webhook", {
          provider,
          transactionId: resolution.transactionId,
          providerReference: resolution.providerReference,
        });
        return false;
      }

      const finalTransactionId =
        resolution.transactionId ||
        asNonEmptyString(payment.transaction_id) ||
        asNonEmptyString(payment.out_trade_no) ||
        asNonEmptyString(payment.order_id) ||
        asNonEmptyString(payment.id);

      if (!finalTransactionId) {
        logWarn("Webhook payment record missing usable transaction id", {
          provider,
          paymentId: payment.id || payment._id,
        });
        return false;
      }

      const amount = resolution.amount > 0 ? resolution.amount : asPositiveNumber(payment.amount);
      const currency = resolution.currency || asNonEmptyString(payment.currency).toUpperCase() || "USD";

      await applySubscriptionPaymentSuccess({
        payment,
        finalTransactionId,
        providerReference: resolution.providerReference || finalTransactionId,
        amount,
        currency,
        paymentMethod: provider,
      });

      logInfo("Webhook payment synchronized", {
        provider,
        paymentId: payment.id || payment._id,
        finalTransactionId,
      });

      return true;
    } catch (error) {
      logError("payment_webhook_sync_failed", error as Error, {
        provider,
      });
      return false;
    }
  }
}
