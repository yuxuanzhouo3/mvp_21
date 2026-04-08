import { getPayPalEnvironment } from "@/lib/config/runtime-env";
import { isChinaRegion, RegionConfig } from "@/lib/config/region";

export interface PaymentOrder {
  id: string;
  amount: number;
  currency: string;
  status: "pending" | "completed" | "failed" | "cancelled";
  userId: string;
  createdAt: Date;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface PaymentResult {
  success: boolean;
  orderId: string;
  transactionId?: string;
  error?: string;
}

export interface PaymentAdapter {
  createOrder(
    amount: number,
    userId: string,
  ): Promise<{
    orderId: string;
    paymentUrl?: string;
    formHtml?: string;
  }>;
  verifyPayment(params: Record<string, unknown>): Promise<PaymentResult>;
  queryOrder(orderId: string): Promise<PaymentOrder>;
  cancelOrder(orderId: string): Promise<void>;
}

class PayPalAdapter implements PaymentAdapter {
  async createOrder(
    amount: number,
    userId: string,
  ): Promise<{ orderId: string; paymentUrl?: string }> {
    const response = await fetch("/api/payment/paypal/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        userId,
        currency: "USD",
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create PayPal order");
    }

    const data = await response.json();
    return {
      orderId: data.orderId,
      paymentUrl: data.approvalUrl,
    };
  }

  async verifyPayment(params: Record<string, unknown>): Promise<PaymentResult> {
    const response = await fetch("/api/payment/paypal/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      return {
        success: false,
        orderId: String(params.orderId || ""),
        error: "Failed to verify PayPal payment",
      };
    }

    const data = await response.json();
    return {
      success: data.verified,
      orderId: data.orderId,
      transactionId: data.transactionId,
    };
  }

  async queryOrder(orderId: string): Promise<PaymentOrder> {
    const response = await fetch(`/api/payment/paypal/query?orderId=${orderId}`);
    if (!response.ok) {
      throw new Error("Failed to query PayPal order");
    }

    return response.json();
  }

  async cancelOrder(orderId: string): Promise<void> {
    await fetch("/api/payment/paypal/cancel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderId }),
    });
  }
}

class AlipayAdapter implements PaymentAdapter {
  async createOrder(
    amount: number,
    userId: string,
  ): Promise<{ orderId: string; formHtml?: string }> {
    const response = await fetch("/api/payment/alipay/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        userId,
        currency: "CNY",
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create Alipay order");
    }

    const data = await response.json();
    return {
      orderId: data.orderId,
      formHtml: data.formHtml,
    };
  }

  async verifyPayment(params: Record<string, unknown>): Promise<PaymentResult> {
    const response = await fetch("/api/payment/alipay/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      return {
        success: false,
        orderId: String(params.out_trade_no || ""),
        error: "Failed to verify Alipay payment",
      };
    }

    const data = await response.json();
    return {
      success: data.verified,
      orderId: data.orderId,
      transactionId: data.tradeNo,
    };
  }

  async queryOrder(orderId: string): Promise<PaymentOrder> {
    const response = await fetch(`/api/payment/alipay/query?orderId=${orderId}`);
    if (!response.ok) {
      throw new Error("Failed to query Alipay order");
    }

    return response.json();
  }

  async cancelOrder(orderId: string): Promise<void> {
    await fetch("/api/payment/alipay/cancel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderId }),
    });
  }
}

export function createPaymentAdapter(): PaymentAdapter {
  if (isChinaRegion()) {
    return new AlipayAdapter();
  }

  return new PayPalAdapter();
}

let paymentInstance: PaymentAdapter | null = null;

export function getPayment(): PaymentAdapter {
  if (!paymentInstance) {
    paymentInstance = createPaymentAdapter();
  }

  return paymentInstance;
}

export function getPaymentProviderName(): string {
  return RegionConfig.payment.primary;
}

export function getPaymentCurrency(): string {
  return isChinaRegion() ? "CNY" : "USD";
}

export function getPayPalCheckoutBaseUrl(): string {
  return getPayPalEnvironment() === "production"
    ? "https://www.paypal.com"
    : "https://www.sandbox.paypal.com";
}

export function formatAmount(amount: number, currency = getPaymentCurrency()): string {
  if (currency.toUpperCase() === "CNY") {
    return `CNY ${amount.toFixed(2)}`;
  }

  return `$${amount.toFixed(2)}`;
}
