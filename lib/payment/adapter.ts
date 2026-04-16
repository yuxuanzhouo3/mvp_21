import { isChinaRegion } from "@/lib/config/region";

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

const LEGACY_ADAPTER_ERROR =
  "Legacy payment adapter has been retired. Use /api/payment/create and /api/payment/confirm.";

class DeprecatedPaymentAdapter implements PaymentAdapter {
  async createOrder(): Promise<{ orderId: string; paymentUrl?: string; formHtml?: string }> {
    throw new Error(LEGACY_ADAPTER_ERROR);
  }

  async verifyPayment(params: Record<string, unknown>): Promise<PaymentResult> {
    return {
      success: false,
      orderId: String(params.orderId || ""),
      error: LEGACY_ADAPTER_ERROR,
    };
  }

  async queryOrder(): Promise<PaymentOrder> {
    throw new Error(LEGACY_ADAPTER_ERROR);
  }

  async cancelOrder(): Promise<void> {
    throw new Error(LEGACY_ADAPTER_ERROR);
  }
}

export function createPaymentAdapter(): PaymentAdapter {
  return new DeprecatedPaymentAdapter();
}

let paymentInstance: PaymentAdapter | null = null;

export function getPayment(): PaymentAdapter {
  if (!paymentInstance) {
    paymentInstance = createPaymentAdapter();
  }

  return paymentInstance;
}

export function getPaymentProviderName(): string {
  return isChinaRegion() ? "wechat" : "stripe";
}

export function getPaymentCurrency(): string {
  return isChinaRegion() ? "CNY" : "USD";
}

export function formatAmount(amount: number, currency = getPaymentCurrency()): string {
  if (currency.toUpperCase() === "CNY") {
    return `CNY ${amount.toFixed(2)}`;
  }

  return `$${amount.toFixed(2)}`;
}
