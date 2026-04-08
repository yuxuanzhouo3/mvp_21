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

const mockPayPalConfirmPayment: any = jest.fn();
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

jest.mock(
  "@/lib/architecture-modules/layers/third-party/payment/providers/paypal-provider",
  () => ({
    PayPalProvider: jest.fn().mockImplementation(() => ({
      confirmPayment: mockPayPalConfirmPayment,
    })),
  }),
);

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
  });

  test("blocks confirmation when the payment belongs to another user", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1" },
    });
    mockGetPaymentRecordById.mockResolvedValue({
      id: "payment-1",
      user_id: "user-2",
      payment_method: "paypal",
      status: "pending",
    });

    const response = await POST(createJsonRequest({ paymentId: "payment-1" }));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ success: false, error: "Forbidden" });
    expect(mockApplySubscriptionPaymentSuccess).not.toHaveBeenCalled();
  });

  test("returns a provider rejection when confirmation fails upstream", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1" },
    });
    mockGetPaymentRecordById.mockResolvedValue({
      id: "payment-1",
      user_id: "user-1",
      payment_method: "paypal",
      transaction_id: "paypal-order-1",
      amount: 199,
      currency: "USD",
      status: "pending",
    });
    mockPayPalConfirmPayment.mockResolvedValue({
      success: false,
      transactionId: "paypal-order-1",
      amount: 199,
      currency: "USD",
    });

    const response = await POST(createJsonRequest({ paymentId: "payment-1" }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ success: false, error: "Payment confirmation failed" });
    expect(mockApplySubscriptionPaymentSuccess).not.toHaveBeenCalled();
  });

  test("returns the stored result for already completed payments without re-confirming upstream", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1" },
    });
    mockGetPaymentRecordById.mockResolvedValue({
      id: "payment-1",
      user_id: "user-1",
      subscription_id: "subscription-1",
      payment_method: "paypal",
      transaction_id: "paypal-capture-1",
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
    expect(mockPayPalConfirmPayment).not.toHaveBeenCalled();
    expect(mockApplySubscriptionPaymentSuccess).not.toHaveBeenCalled();
    expect(payload).toEqual({
      success: true,
      transactionId: "paypal-capture-1",
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

  test("syncs the subscription after a successful provider confirmation", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1" },
    });
    mockGetPaymentRecordById.mockResolvedValue({
      id: "payment-1",
      user_id: "user-1",
      payment_method: "paypal",
      transaction_id: "paypal-order-1",
      amount: 299,
      currency: "USD",
      status: "pending",
    });
    mockPayPalConfirmPayment.mockResolvedValue({
      success: true,
      transactionId: "paypal-capture-1",
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
    expect(mockApplySubscriptionPaymentSuccess).toHaveBeenCalledWith({
      payment: expect.objectContaining({
        id: "payment-1",
        user_id: "user-1",
        payment_method: "paypal",
      }),
      finalTransactionId: "paypal-capture-1",
      providerReference: "paypal-order-1",
      amount: 299,
      currency: "USD",
      paymentMethod: "paypal",
    });
    expect(payload).toEqual({
      success: true,
      transactionId: "paypal-capture-1",
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
