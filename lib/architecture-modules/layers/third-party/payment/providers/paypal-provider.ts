import {
  PaymentOrder,
  PaymentResult,
  PaymentConfirmation,
  RefundResult,
} from "../router";

interface PayPalOrderResponseLink {
  href?: string;
  rel?: string;
}

interface PayPalOrderResponse {
  id?: string;
  status?: string;
  links?: PayPalOrderResponseLink[];
  purchase_units?: Array<{
    amount?: {
      currency_code?: string;
      value?: string;
    };
    payments?: {
      captures?: Array<{
        id?: string;
        status?: string;
        amount?: {
          currency_code?: string;
          value?: string;
        };
      }>;
    };
  }>;
}

export class PayPalProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly webhookId: string;
  private readonly appUrl: string;
  private readonly sandbox: boolean;

  constructor(config: NodeJS.ProcessEnv) {
    this.clientId = config.PAYPAL_CLIENT_ID || "";
    this.clientSecret = config.PAYPAL_CLIENT_SECRET || "";
    this.webhookId = config.PAYPAL_WEBHOOK_ID || "";
    this.appUrl =
      config.NEXT_PUBLIC_APP_URL || config.APP_URL || "http://localhost:3000";
    this.sandbox = (config.PAYPAL_SANDBOX || "true").toLowerCase() === "true";
  }

  private getBaseUrl() {
    return this.sandbox
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com";
  }

  private isConfigured() {
    return Boolean(this.clientId && this.clientSecret);
  }

  private parseAmount(value: string | undefined) {
    const parsed = Number.parseFloat(value || "0");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.isConfigured()) {
      return null;
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      "base64",
    );

    try {
      const response = await fetch(`${this.getBaseUrl()}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${auth}`,
        },
        body: "grant_type=client_credentials",
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as { access_token?: string };
      return data.access_token || null;
    } catch (error) {
      console.error("Failed to get PayPal access token:", error);
      return null;
    }
  }

  async createPayment(order: PaymentOrder): Promise<PaymentResult> {
    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        return {
          success: false,
          error: "PayPal is not configured.",
        };
      }

      const customId = {
        userId: order.userId,
        planType: order.planType,
        billingCycle: order.billingCycle,
      };

      const response = await fetch(`${this.getBaseUrl()}/v2/checkout/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              amount: {
                currency_code: order.currency,
                value: order.amount.toFixed(2),
              },
              description: order.description,
              custom_id: JSON.stringify(customId),
            },
          ],
          application_context: {
            return_url: `${this.appUrl}/payment/success`,
            cancel_url: `${this.appUrl}/payment/cancel`,
          },
        }),
      });

      const paypalOrder = (await response.json()) as PayPalOrderResponse & {
        message?: string;
      };
      if (!response.ok || !paypalOrder.id) {
        return {
          success: false,
          error: paypalOrder.message || "Failed to create PayPal order",
        };
      }

      const approveLink = (paypalOrder.links || []).find(
        (link) => link.rel === "approve",
      );

      return {
        success: true,
        paymentId: paypalOrder.id,
        paymentUrl: approveLink?.href || "",
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create PayPal order";
      return {
        success: false,
        error: message,
      };
    }
  }

  async confirmPayment(orderId: string): Promise<PaymentConfirmation> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error("PayPal is not configured.");
    }

    const response = await fetch(
      `${this.getBaseUrl()}/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    const captureResult = (await response.json()) as PayPalOrderResponse & {
      message?: string;
    };
    if (!response.ok) {
      throw new Error(captureResult.message || "Failed to capture PayPal order");
    }

    const capture =
      captureResult.purchase_units?.[0]?.payments?.captures?.[0] || undefined;
    const amount = this.parseAmount(
      capture?.amount?.value || captureResult.purchase_units?.[0]?.amount?.value,
    );
    const currency =
      capture?.amount?.currency_code ||
      captureResult.purchase_units?.[0]?.amount?.currency_code ||
      "USD";

    return {
      success: captureResult.status === "COMPLETED",
      transactionId: capture?.id || captureResult.id || orderId,
      amount,
      currency: currency.toUpperCase(),
    };
  }

  async refundPayment(_paymentId: string, _amount: number): Promise<RefundResult> {
    throw new Error("PayPal refund is not implemented");
  }

  async verifyWebhookSignature(input: {
    body: Record<string, unknown>;
    transmissionId: string;
    transmissionSig: string;
    transmissionTime: string;
    certUrl: string;
    authAlgo?: string;
  }): Promise<boolean> {
    if (!this.webhookId) {
      return false;
    }

    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return false;
    }

    try {
      const response = await fetch(
        `${this.getBaseUrl()}/v1/notifications/verify-webhook-signature`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            transmission_id: input.transmissionId,
            transmission_time: input.transmissionTime,
            cert_url: input.certUrl,
            auth_algo: input.authAlgo || "SHA256withRSA",
            transmission_sig: input.transmissionSig,
            webhook_id: this.webhookId,
            webhook_event: input.body,
          }),
        },
      );

      if (!response.ok) {
        return false;
      }

      const result = (await response.json()) as {
        verification_status?: string;
      };
      return result.verification_status === "SUCCESS";
    } catch (error) {
      console.error("PayPal webhook verification failed:", error);
      return false;
    }
  }
}
