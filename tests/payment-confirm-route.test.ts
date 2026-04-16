import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { NextRequest, NextResponse } from "next/server";

const mockRequireAuth: any = jest.fn();
const mockCreateAuthErrorResponse: any = jest.fn();
const mockGetPaymentRecordById: any = jest.fn();
const mockGetPaymentRecordForUserByReference: any = jest.fn();
const mockApplySubscriptionPaymentSuccess: any = jest.fn();
const mockPaymentRateLimit: any = jest.fn();
const mockLogBusinessEvent: any = jest.fn();
const mockLogError: any = jest.fn();
const mockLogSecurityEvent: any = jest.fn();
const mockObserveOperationalMetric: any = jest.fn();

const mockStripeConfirmPayment: any = jest.fn();
const mockAlipayConfirmPayment: any = jest.fn();
const mockAlipayQueryPayment: any = jest.fn();
const mockWechatQueryOrderByOutTradeNo: any = jest.fn();

jest.mock("@/lib/auth/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  createAuthErrorResponse: (...args: unknown[]) => mockCreateAuthErrorResponse(...args),
}));

jest.mock("@/lib/payment/subscription-payment-sync", () => ({
  getPaymentRecordById: (...args: unknown[]) => mockGetPaymentRecordById(...args),
  getPaymentRecordForUserByReference: (...args: unknown[]) =>
    mockGetPaymentRecordForUserByReference(...args),
  applySubscriptionPaymentSuccess: (...args: unknown[]) =>
    mockApplySubscriptionPaymentSuccess(...args),
}));

jest.mock("@/lib/security/rate-limit", () => ({
  paymentRateLimit: (...args: unknown[]) => mockPaymentRateLimit(...args),
}));

jest.mock("@/lib/utils/logger", () => ({
  logBusinessEvent: (...args: unknown[]) => mockLogBusinessEvent(...args),
  logError: (...args: unknown[]) => mockLogError(...args),
  logSecurityEvent: (...args: unknown[]) => mockLogSecurityEvent(...args),
}));

jest.mock("@/lib/monitoring/operational-observability", () => ({
  observeOperationalMetric: (...args: unknown[]) => mockObserveOperationalMetric(...args),
}));

jest.mock(
  "@/lib/architecture-modules/layers/third-party/payment/providers/stripe-provider",
  () => ({
    StripeProvider: jest.fn().mockImplementation(() => ({
      confirmPayment: mockStripeConfirmPayment,
    })),
  }),
);

jest.mock(
  "@/lib/architecture-modules/layers/third-party/payment/providers/alipay-provider",
  () => ({
    AlipayProvider: jest.fn().mockImplementation(() => ({
      confirmPayment: mockAlipayConfirmPayment,
      queryPayment: mockAlipayQueryPayment,
    })),
  }),
);

jest.mock(
  "@/lib/architecture-modules/layers/third-party/payment/providers/wechat-provider-v3",
  () => ({
    WechatProviderV3: jest.fn().mockImplementation(() => ({
      queryOrderByOutTradeNo: mockWechatQueryOrderByOutTradeNo,
    })),
  }),
);

import { POST } from "@/app/api/payment/confirm/route";

function createJsonRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/payment/confirm", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("payment confirm route coverage", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockCreateAuthErrorResponse.mockReturnValue(
      NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    );

    mockPaymentRateLimit.mockImplementation(
      (_request: unknown, _response: unknown, next: () => Promise<void> | void) => next(),
    );
  });

  test("returns auth error when the user is not signed in", async () => {
    mockRequireAuth.mockResolvedValue(null);

    const response = await POST(createJsonRequest({ paymentId: "payment-1" }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ success: false, error: "Unauthorized" });
    expect(mockCreateAuthErrorResponse).toHaveBeenCalled();
    expect(mockObserveOperationalMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: "payment_confirm",
        outcome: "rejected",
        statusCode: 401,
      }),
    );
  });

  test("blocks confirmation when the payment belongs to another user", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1" },
    });
    mockGetPaymentRecordById.mockResolvedValue({
      id: "payment-1",
      user_id: "user-2",
      payment_method: "stripe",
      status: "pending",
    });

    const response = await POST(createJsonRequest({ paymentId: "payment-1" }));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ success: false, error: "Forbidden" });
    expect(mockApplySubscriptionPaymentSuccess).not.toHaveBeenCalled();
  });

  test("returns a provider rejection when stripe confirmation fails upstream", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1" },
    });
    mockGetPaymentRecordById.mockResolvedValue({
      id: "payment-1",
      user_id: "user-1",
      payment_method: "stripe",
      transaction_id: "stripe-session-1",
      amount: 199,
      currency: "USD",
      status: "pending",
    });
    mockStripeConfirmPayment.mockResolvedValue({
      success: false,
      transactionId: "stripe-session-1",
      amount: 199,
      currency: "USD",
    });

    const response = await POST(createJsonRequest({ paymentId: "payment-1" }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ success: false, error: "Payment confirmation failed" });
    expect(mockApplySubscriptionPaymentSuccess).not.toHaveBeenCalled();
    expect(mockObserveOperationalMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: "payment_confirm",
        outcome: "rejected",
        statusCode: 400,
      }),
    );
  });

  test("returns the stored result for already completed stripe payments without re-confirming upstream", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1" },
    });
    mockGetPaymentRecordById.mockResolvedValue({
      id: "payment-1",
      user_id: "user-1",
      subscription_id: "subscription-1",
      payment_method: "stripe",
      transaction_id: "stripe-session-1",
      amount: 299,
      currency: "USD",
      status: "completed",
      billing_cycle: "monthly",
      metadata: {
        planType: "pro",
        billingCycle: "monthly",
      },
    });

    const response = await POST(createJsonRequest({ paymentId: "payment-1" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockStripeConfirmPayment).not.toHaveBeenCalled();
    expect(mockApplySubscriptionPaymentSuccess).not.toHaveBeenCalled();
    expect(mockObserveOperationalMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: "payment_confirm",
        outcome: "success",
        statusCode: 200,
      }),
    );
    expect(payload).toEqual({
      success: true,
      transactionId: "stripe-session-1",
      amount: 299,
      currency: "USD",
      subscription: {
        id: "subscription-1",
        planId: "pro",
        status: "active",
        billingCycle: "monthly",
      },
    });
  });

  test("syncs the subscription after a successful stripe confirmation", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1" },
    });
    mockGetPaymentRecordById.mockResolvedValue({
      id: "payment-1",
      user_id: "user-1",
      payment_method: "stripe",
      transaction_id: "stripe-session-1",
      amount: 299,
      currency: "USD",
      status: "pending",
    });
    mockStripeConfirmPayment.mockResolvedValue({
      success: true,
      transactionId: "stripe-payment-intent-1",
      amount: 299,
      currency: "USD",
    });
    mockApplySubscriptionPaymentSuccess.mockResolvedValue({
      paymentId: "payment-1",
      subscriptionId: "subscription-1",
      metadata: {
        planType: "pro",
        billingCycle: "monthly",
        days: 30,
        productType: "subscription",
        productName: "Pro Monthly Subscription",
      },
    });

    const response = await POST(createJsonRequest({ paymentId: "payment-1" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockObserveOperationalMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: "payment_confirm",
        outcome: "success",
        statusCode: 200,
      }),
    );
    expect(mockApplySubscriptionPaymentSuccess).toHaveBeenCalledWith({
      payment: expect.objectContaining({
        id: "payment-1",
        user_id: "user-1",
        payment_method: "stripe",
      }),
      finalTransactionId: "stripe-payment-intent-1",
      providerReference: "stripe-session-1",
      amount: 299,
      currency: "USD",
      paymentMethod: "stripe",
    });
    expect(payload).toEqual({
      success: true,
      transactionId: "stripe-payment-intent-1",
      amount: 299,
      currency: "USD",
      subscription: {
        id: "subscription-1",
        planId: "pro",
        status: "active",
        billingCycle: "monthly",
      },
    });
  });
});
